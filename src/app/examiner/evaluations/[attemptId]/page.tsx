import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EvaluationWorkspace } from "@/components/examinations/evaluation-workspace";
import { requirePageRole } from "@/lib/auth/authorization";
import {
  EvaluationServiceError,
  getExaminerEvaluation,
} from "@/lib/evaluations/service";

export const instant = false;

type PageProps = { params: Promise<{ attemptId: string }> };

export default async function ExaminerEvaluationPage({ params }: PageProps) {
  const user = await requirePageRole("EXAMINER");
  const { attemptId } = await params;
  let evaluation;
  try {
    evaluation = await getExaminerEvaluation(user.id, attemptId);
  } catch (error) {
    if (
      error instanceof EvaluationServiceError &&
      (error.code === "not_found" || error.code === "attempt_not_submitted")
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <AppShell user={user}>
      <EvaluationWorkspace initialEvaluation={evaluation} />
    </AppShell>
  );
}
