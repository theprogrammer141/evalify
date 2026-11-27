import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { removeQuestionFromExamination } from "@/lib/examinations/service";

type RouteContext = {
  params: Promise<{ id: string; assignmentId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id, assignmentId } = await params;
  const result = await removeQuestionFromExamination(
    authorization.user.id,
    id,
    assignmentId,
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
  if (result.status === "last_question") {
    return NextResponse.json(
      { error: "published_question_required" },
      { status: 409 },
    );
  }

  return NextResponse.json({ removed: true });
}