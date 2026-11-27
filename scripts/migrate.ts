import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";

async function migrate() {
  loadEnvConfig(process.cwd());
  const { sql } = await import("@/lib/db");
  try {
    const migrationFiles = [
      "0001_identity.sql",
      "0002_examinations.sql",
    ] as const;
    const migrations = await Promise.all(
      migrationFiles.map((file) =>
        readFile(
          fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)),
          "utf8",
        ),
      ),
    );

    await sql.begin(async (transaction) => {
      for (const migration of migrations) {
        await transaction.unsafe(migration).simple();
      }
    });

    console.info("Database schema is up to date.");
  } finally {
    await sql.end();
  }
}

migrate()
  .catch((error: unknown) => {
    console.error("Database migration failed.", error);
    process.exitCode = 1;
  })
