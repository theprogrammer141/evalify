import type { AttemptAnswerValue, AttemptSnapshotQuestion } from "@/lib/attempts/types";
import type { EvaluationStatus } from "@/lib/db/schema";

export type EvaluationGradeValue = {
  source: "AUTO" | "MANUAL";
  awardedMarks: number | null;
};

export function getAutomaticMarks(
  question: AttemptSnapshotQuestion,
  answer: AttemptAnswerValue | null,
): number | null {
  if (question.type === "WRITTEN") return null;
  if (answer === null) return 0;

  if (question.type === "SINGLE_CHOICE") {
    const correctOptionId = question.markingRules.correctOptionId;
    return answer.kind === "single" &&
      typeof correctOptionId === "string" &&
      answer.optionId === correctOptionId
      ? question.marks
      : 0;
  }

  const correctOptionIds = question.markingRules.correctOptionIds;
  if (answer.kind !== "multiple" || !Array.isArray(correctOptionIds)) {
    return 0;
  }

  return answer.optionIds.length === correctOptionIds.length &&
    answer.optionIds.every((optionId) => correctOptionIds.includes(optionId))
    ? question.marks
    : 0;
}

export function getEvaluationStatus(
  grades: EvaluationGradeValue[],
): EvaluationStatus {
  const manualGrades = grades.filter((grade) => grade.source === "MANUAL");
  if (manualGrades.length === 0) return "AUTO_GRADED";

  const completedManualGrades = manualGrades.filter(
    (grade) => grade.awardedMarks !== null,
  );
  if (completedManualGrades.length === manualGrades.length) return "COMPLETED";
  if (completedManualGrades.length === 0) return "AWAITING_MANUAL";
  return "PARTIALLY_EVALUATED";
}

export function getEvaluationTotals(grades: EvaluationGradeValue[]) {
  const autoMarks = grades.reduce(
    (total, grade) =>
      grade.source === "AUTO" ? total + (grade.awardedMarks ?? 0) : total,
    0,
  );
  const manualMarks = grades.reduce(
    (total, grade) =>
      grade.source === "MANUAL" ? total + (grade.awardedMarks ?? 0) : total,
    0,
  );
  return { autoMarks, manualMarks, totalMarks: autoMarks + manualMarks };
}

export function isAwardedMarkValid(awardedMarks: number, maximumMarks: number) {
  return (
    Number.isInteger(awardedMarks) &&
    awardedMarks >= 0 &&
    awardedMarks <= maximumMarks
  );
}
