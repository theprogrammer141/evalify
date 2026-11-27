import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  evaluationErrorResponse,
  invalidEvaluationRequestResponse,
} from "@/lib/evaluations/http";
import { publishEvaluation } from "@/lib/evaluations/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) {
    return invalidEvaluationRequestResponse();
  }

  try {
    return NextResponse.json(
      {
        evaluation: await publishEvaluation({
          examinerId: authorization.user.id,
          attemptId,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return evaluationErrorResponse(error);
  }
}
