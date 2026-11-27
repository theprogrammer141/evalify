import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { listExaminerEvaluations } from "@/lib/evaluations/service";
import { evaluationErrorResponse } from "@/lib/evaluations/http";

export async function GET() {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  try {
    return NextResponse.json(
      { evaluations: await listExaminerEvaluations(authorization.user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return evaluationErrorResponse(error);
  }
}
