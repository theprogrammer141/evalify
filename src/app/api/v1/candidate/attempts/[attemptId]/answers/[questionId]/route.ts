import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { attemptErrorResponse, invalidRequestResponse } from "@/lib/attempts/http";
import { saveAttemptAnswerSchema } from "@/lib/attempts/validation";
import { saveCandidateAnswer } from "@/lib/attempts/service";

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ attemptId: string; questionId: string }> },
) {
  const receivedAt = new Date();
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { attemptId, questionId } = await params;
  if (
    !z.uuid().safeParse(attemptId).success ||
    !z.uuid().safeParse(questionId).success
  ) {
    return invalidRequestResponse();
  }

  const parsed = saveAttemptAnswerSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse();

  try {
    const answer = await saveCandidateAnswer({
      candidateId: authorization.user.id,
      attemptId,
      questionId,
      receivedAt,
      ...parsed.data,
    });
    return NextResponse.json(
      { answer },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return attemptErrorResponse(error);
  }
}
