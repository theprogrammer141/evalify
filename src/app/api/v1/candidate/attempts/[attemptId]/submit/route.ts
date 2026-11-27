import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { attemptErrorResponse, invalidRequestResponse } from "@/lib/attempts/http";
import { finalizeCandidateAttempt } from "@/lib/attempts/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const receivedAt = new Date();
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) {
    return invalidRequestResponse();
  }

  try {
    return NextResponse.json(
      {
        attempt: await finalizeCandidateAttempt({
          candidateId: authorization.user.id,
          attemptId,
          receivedAt,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return attemptErrorResponse(error);
  }
}
