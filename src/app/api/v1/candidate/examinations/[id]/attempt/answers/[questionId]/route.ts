import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { saveCandidateAnswer } from "@/lib/monitoring/service";
import { attemptAnswerInputSchema } from "@/lib/monitoring/validation";

type RouteContext = {
  params: Promise<{ id: string; questionId: string }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  const parsed = attemptAnswerInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_answer", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id, questionId } = await params;
  const result = await saveCandidateAnswer(
    authorization.user.id,
    id,
    questionId,
    parsed.data,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "invalid_answer") {
    return NextResponse.json({ error: "invalid_answer" }, { status: 400 });
  }
  if (result.status === "expired" || result.status === "finalized") {
    return NextResponse.json({ error: result.status }, { status: 409 });
  }

  return NextResponse.json(
    { savedAt: result.savedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
