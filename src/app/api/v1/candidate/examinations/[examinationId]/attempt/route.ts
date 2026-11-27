import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { attemptErrorResponse, invalidRequestResponse } from "@/lib/attempts/http";
import { startCandidateAttempt } from "@/lib/attempts/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ examinationId: string }> },
) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { examinationId } = await params;
  if (!z.uuid().safeParse(examinationId).success) {
    return invalidRequestResponse();
  }

  try {
    const attempt = await startCandidateAttempt(
      authorization.user.id,
      examinationId,
    );
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
