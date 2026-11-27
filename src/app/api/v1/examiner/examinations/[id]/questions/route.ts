import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  addQuestionToExamination,
  getExaminerExamination,
  updateExaminationQuestions,
} from "@/lib/examinations/service";
import {
  assignmentUpdateSchema,
  questionAssignmentSchema,
} from "@/lib/examinations/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const examination = await getExaminerExamination(
    authorization.user.id,
    id,
  );
  if (!examination) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { questions: examination.questions, totalMarks: examination.totalMarks },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const parsed = questionAssignmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_assignment", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await addQuestionToExamination(
    authorization.user.id,
    id,
    parsed.data.questionId,
    parsed.data.marks,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "question_not_found") {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }
  if (result.status === "already_assigned") {
    return NextResponse.json(
      { error: "question_already_assigned" },
      { status: 409 },
    );
  }
  if (result.status === "completed") {
    return NextResponse.json(
      { error: "examination_completed" },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { question: result.question },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const parsed = assignmentUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_assignment", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateExaminationQuestions(
    authorization.user.id,
    id,
    parsed.data.items,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "completed") {
    return NextResponse.json(
      { error: "examination_completed" },
      { status: 409 },
    );
  }
  if (result.status === "invalid_questions") {
    return NextResponse.json(
      { error: "invalid_assignment_set" },
      { status: 400 },
    );
  }

  return NextResponse.json({ saved: true });
}