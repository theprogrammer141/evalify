import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { getMonitoringDashboard } from "@/lib/monitoring/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi();
  if (!authorization.authorized) return authorization.response;
  if (
    authorization.user.role !== "EXAMINER" &&
    authorization.user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const dashboard = await getMonitoringDashboard(id, {
    userId: authorization.user.id,
    isAdmin: authorization.user.role === "ADMIN",
  });
  if (!dashboard) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(dashboard, {
    headers: { "Cache-Control": "no-store" },
  });
}
