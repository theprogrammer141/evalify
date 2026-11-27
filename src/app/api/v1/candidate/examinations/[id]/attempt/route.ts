import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  attemptErrorResponse,
  invalidRequestResponse,
} from "@/lib/attempts/http";
import {
  startCandidateAttempt,
  getCandidateAttemptForExamination,
} from "@/lib/attempts/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidRequestResponse();

  try {
    const attempt = await getCandidateAttemptForExamination(
      authorization.user.id,
      id,
    );
    if (!attempt) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { attempt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return attemptErrorResponse(error);
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidRequestResponse();

  try {
    const attempt = await startCandidateAttempt(authorization.user.id, id);
    return NextResponse.json(
      { attempt },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return attemptErrorResponse(error);
  }
}
