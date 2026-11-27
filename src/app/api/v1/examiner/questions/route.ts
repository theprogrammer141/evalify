import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  createBankQuestion,
  listQuestionBank,
} from "@/lib/examinations/service";
import { questionSchema } from "@/lib/examinations/validation";

export async function GET() {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  return NextResponse.json(
    { questions: await listQuestionBank(authorization.user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const parsed = questionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_question", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const question = await createBankQuestion(authorization.user.id, parsed.data);
  return NextResponse.json(
    { question },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}