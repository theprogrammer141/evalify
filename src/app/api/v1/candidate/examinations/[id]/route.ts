import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { getCandidateExamination } from "@/lib/examinations/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const examination = await getCandidateExamination(
    authorization.user.id,
    id,
  );
  if (!examination) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { examination },
    { headers: { "Cache-Control": "no-store" } },
  );
}