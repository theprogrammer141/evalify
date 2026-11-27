import net from "node:net";
import postgres from "postgres";

export const connectPostgresSocket: NonNullable<postgres.Options["socket"]> = (
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
  // postgres.js's socket contract is narrower than net.Socket's overloaded end().
  return socket as unknown as ReturnType<
    NonNullable<postgres.Options["socket"]>
  >;
};
