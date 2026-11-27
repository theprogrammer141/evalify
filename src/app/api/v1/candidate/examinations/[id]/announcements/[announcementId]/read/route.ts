import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { markCandidateAnnouncementRead } from "@/lib/monitoring/service";

type RouteContext = {
  params: Promise<{ id: string; announcementId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id, announcementId } = await params;
  const marked = await markCandidateAnnouncementRead(
    authorization.user.id,
    id,
    announcementId,
  );
  if (!marked) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ read: true });
}
