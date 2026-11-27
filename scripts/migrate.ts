import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

async function migrate() {
  loadEnvConfig(process.cwd());
  const { sql } = await import("@/lib/db");
  try {
    const migrationFiles = [
      "0001_identity.sql",
      "0002_examinations.sql",
      "0003_monitoring.sql",
    ] as const;
    const migrations = await Promise.all(
      migrationFiles.map((file) =>
        readFile(
          fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)),
          "utf8",
        ),
      ),
    const migrationsPath = fileURLToPath(
      new URL("../migrations/", import.meta.url),
    );
    const migrationFiles = (await readdir(migrationsPath))
      .filter((file) => /^\d+_[\w-]+\.sql$/.test(file))
      .sort();

    for (const file of migrationFiles) {
      const migration = await readFile(join(migrationsPath, file), "utf8");
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration).simple();
      });
      console.info(`Applied ${file}.`);
    }

    console.info("Database migrations are up to date.");
  } finally {
    await sql.end();
  }
}

migrate()
  .catch((error: unknown) => {
    console.error("Database migration failed.", error);
    process.exitCode = 1;
  })
