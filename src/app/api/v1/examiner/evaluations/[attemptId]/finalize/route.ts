import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  evaluationErrorResponse,
  invalidEvaluationRequestResponse,
} from "@/lib/evaluations/http";
import { finalizeEvaluation } from "@/lib/evaluations/service";
import { finalizeEvaluationSchema } from "@/lib/evaluations/validation";

type RouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) {
    return invalidEvaluationRequestResponse();
  }
  const parsed = finalizeEvaluationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return NextResponse.json(
      {
        evaluation: await finalizeEvaluation({
          examinerId: authorization.user.id,
          attemptId,
          ...parsed.data,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return evaluationErrorResponse(error);
  }
}
