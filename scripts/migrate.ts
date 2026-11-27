import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";

async function migrate() {
  loadEnvConfig(process.cwd());
  const { sql } = await import("@/lib/db");
  try {
    const migrationPath = fileURLToPath(
      new URL("../migrations/0001_identity.sql", import.meta.url),
    );
    const migration = await readFile(migrationPath, "utf8");

    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration).simple();
    });

    console.info("Identity schema is up to date.");
  } finally {
    await sql.end();
  }
}

migrate()
  .catch((error: unknown) => {
    console.error("Database migration failed.", error);
    process.exitCode = 1;
  })
