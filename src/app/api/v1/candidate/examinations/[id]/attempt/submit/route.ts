import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { submitCandidateAttempt } from "@/lib/monitoring/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const result = await submitCandidateAttempt(authorization.user.id, id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "expired") {
    return NextResponse.json({ status: "EXPIRED" }, { status: 409 });
  }
  if (result.status === "finalized") {
    return NextResponse.json({ status: result.attempt.status }, { status: 409 });
  }

  return NextResponse.json({ status: "SUBMITTED", submittedAt: result.attempt.submittedAt });
}
