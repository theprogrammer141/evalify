import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { updateBankQuestion } from "@/lib/examinations/service";
import { questionSchema } from "@/lib/examinations/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const parsed = questionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_question", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const question = await updateBankQuestion(
    authorization.user.id,
    id,
    parsed.data,
  );
  if (!question) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { question },
    { headers: { "Cache-Control": "no-store" } },
  );
}