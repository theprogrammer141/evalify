import net from "node:net";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { getDatabaseUrl } from "@/lib/env";

const connectionString = getDatabaseUrl();

/**
 * Neon's pooler hostname resolves to several IPv4/IPv6 addresses and Node's
 * default happy-eyeballs attempt window (250 ms) can expire before the TCP
 * handshake to a far region completes, aborting every candidate with
 * ETIMEDOUT. postgres.js builds its own sockets without exposing that knob,
 * so supply a socket with a realistic per-address window.
 */
const connectSocket: NonNullable<postgres.Options["socket"]> = (
  _options,
  host,
  port,
) => {
  const socket = net.connect({
    host,
    port,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 5_000,
  });

  socket.setNoDelay(true);
  // net.Socket's overloaded end() signature is narrower than postgres.js's
  // SocketLike contract; the runtime surface used by the driver is identical.
  return socket as unknown as ReturnType<NonNullable<postgres.Options["socket"]>>;
};

const globalForDb = globalThis as typeof globalThis & {
  __evalifySql?: ReturnType<typeof postgres>;
};

/**
 * Pooled connection (PgBouncer, transaction mode) — keep `prepare: false`.
 * Migrations and dumps should use DATABASE_URL_UNPOOLED instead.
 */
export const sql =
  globalForDb.__evalifySql ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
    ssl: "require",
    socket: connectSocket,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__evalifySql = sql;
}

export const db = drizzle(sql, { schema });
