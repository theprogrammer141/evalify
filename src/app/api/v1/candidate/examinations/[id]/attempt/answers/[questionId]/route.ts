import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  attemptErrorResponse,
  invalidRequestResponse,
} from "@/lib/attempts/http";
import {
  getCandidateAttemptForExamination,
  saveCandidateAnswer,
} from "@/lib/attempts/service";
import { saveAttemptAnswerSchema } from "@/lib/attempts/validation";

type RouteContext = {
  params: Promise<{ id: string; questionId: string }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  const receivedAt = new Date();
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const { id, questionId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(questionId).success) {
    return invalidRequestResponse();
  }

  const parsed = saveAttemptAnswerSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse();

  try {
    const attempt = await getCandidateAttemptForExamination(
      authorization.user.id,
      id,
    );
    if (!attempt) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const answer = await saveCandidateAnswer({
      candidateId: authorization.user.id,
      attemptId: attempt.id,
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
