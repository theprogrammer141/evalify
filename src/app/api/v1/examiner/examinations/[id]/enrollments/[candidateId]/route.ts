import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { removeCandidateEnrollment } from "@/lib/examinations/service";

type RouteContext = {
  params: Promise<{ id: string; candidateId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id, candidateId } = await params;
  const result = await removeCandidateEnrollment(
    authorization.user.id,
    id,
    candidateId,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "completed") {
    return NextResponse.json(
      { error: "examination_completed" },
      { status: 409 },
    );
  }
  if (result.status === "last_candidate") {
    return NextResponse.json(
      { error: "published_candidate_required" },
      { status: 409 },
    );
  }

  return NextResponse.json({ removed: true });
}