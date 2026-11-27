import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  getCandidateAttempt,
  startCandidateAttempt,
} from "@/lib/monitoring/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const attempt = await getCandidateAttempt(authorization.user.id, id);
  if (!attempt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { attempt },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const result = await startCandidateAttempt(authorization.user.id, id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "unavailable") {
    return NextResponse.json(
      { error: "examination_unavailable" },
      { status: 409 },
    );
  }

  const attempt = await getCandidateAttempt(authorization.user.id, id);
  return NextResponse.json(
    { attempt },
    { status: result.status === "started" ? 201 : 200 },
  );
}
