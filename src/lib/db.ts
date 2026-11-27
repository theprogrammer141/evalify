import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { connectPostgresSocket } from "@/lib/db/socket";
import { getDatabaseUrl } from "@/lib/env";

const connectionString = getDatabaseUrl();

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
    socket: connectPostgresSocket,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__evalifySql = sql;
}

export const db = drizzle(sql, { schema });
