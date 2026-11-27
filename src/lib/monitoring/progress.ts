import type { AttemptResponse, AttemptStatus } from "@/lib/db/schema";

type PersistedAnswer = {
  questionId: string;
  response: AttemptResponse;
  markedForReview: boolean;
};

export function getQuestionProgress(
  questionIds: string[],
  answers: PersistedAnswer[],
) {
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  const answeredCount = questionIds.filter((questionId) => {
    const response = answerByQuestion.get(questionId)?.response;
    if (!response) return false;
    return response.type === "options"
      ? response.optionIds.length > 0
      : response.text.trim().length > 0;
  }).length;

  return {
    questionCount: questionIds.length,
    answeredCount,
    unansweredCount: questionIds.length - answeredCount,
    reviewCount: questionIds.filter(
      (questionId) => answerByQuestion.get(questionId)?.markedForReview,
    ).length,
  };
}

export function getAttemptStatusCounts(
  statuses: (AttemptStatus | "NOT_STARTED")[],
) {
  return {
    enrolled: statuses.length,
    started: statuses.filter((status) => status !== "NOT_STARTED").length,
    submitted: statuses.filter((status) => status === "SUBMITTED").length,
    expired: statuses.filter((status) => status === "EXPIRED").length,
    notStarted: statuses.filter((status) => status === "NOT_STARTED").length,
    inProgress: statuses.filter((status) => status === "IN_PROGRESS").length,
  };
}
