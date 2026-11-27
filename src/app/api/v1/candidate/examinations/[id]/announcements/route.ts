import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { listCandidateAnnouncements } from "@/lib/monitoring/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const announcements = await listCandidateAnnouncements(
    authorization.user.id,
    id,
  );
  if (!announcements) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { announcements },
    { headers: { "Cache-Control": "no-store" } },
  );
}
