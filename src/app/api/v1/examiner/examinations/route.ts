import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  createExamination,
  listExaminations,
} from "@/lib/examinations/service";
import { examinationSchema } from "@/lib/examinations/validation";

export async function GET() {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  return NextResponse.json(
    { examinations: await listExaminations(authorization.user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const parsed = examinationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_examination", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const examination = await createExamination(
    authorization.user.id,
    parsed.data,
  );
  return NextResponse.json(
    { examination },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}