import { NextResponse } from "next/server";
import { EvaluationServiceError } from "@/lib/evaluations/service";

export function evaluationErrorResponse(error: unknown): NextResponse {
  if (error instanceof EvaluationServiceError) {
    return NextResponse.json(
      { error: error.code },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  throw error;
}

export function invalidEvaluationRequestResponse(): NextResponse {
  return NextResponse.json(
    { error: "invalid_request" },
    {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
