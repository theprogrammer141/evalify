import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type HealthRow = {
  database: string;
  version: string;
  server_time: string;
};

export async function GET() {
  const startedAt = performance.now();

  try {
    const [row] = await sql<HealthRow[]>`
      select
        current_database() as database,
        version() as version,
        now()::text as server_time
    `;

    return NextResponse.json({
      ok: true,
      service: "postgres",
      database: row.database,
      version: row.version.split(" ").slice(0, 2).join(" "),
      serverTime: row.server_time,
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    console.error("[health/db] query failed", error);

    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;

    return NextResponse.json(
      { ok: false, service: "postgres", error: "database_unavailable", code },
      { status: 503 },
    );
  }
}
