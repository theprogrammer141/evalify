import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { recordCandidateMonitoringEvent } from "@/lib/monitoring/service";
import { monitoringEventInputSchema } from "@/lib/monitoring/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const parsed = monitoringEventInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_event", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await recordCandidateMonitoringEvent(
    authorization.user.id,
    id,
    parsed.data,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status !== "recorded") {
    return NextResponse.json({ error: result.status }, { status: 409 });
  }

  return NextResponse.json({ recorded: true }, { status: 201 });
}
