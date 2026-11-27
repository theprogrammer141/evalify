import type {
  AttemptAnswerValue,
  AttemptSnapshot,
  AttemptSnapshotQuestion,
} from "@/lib/attempts/types";
import type { EvaluationStatus } from "@/lib/db/schema";
import { getAutomaticMarks } from "@/lib/evaluations/logic";

export type CandidatePerformance = {
  candidateEmail: string;
  attemptStatus: "SUBMITTED" | "EXPIRED";
  completedAt: string | null;
  evaluationStatus: EvaluationStatus | null;
  totalMarks: number | null;
  autoMarks: number | null;
  manualMarks: number | null;
  maximumMarks: number;
  published: boolean;
};

export function scorePercentage(totalMarks: number, maximumMarks: number) {
  return Math.round((totalMarks / maximumMarks) * 1000) / 10;
}

function exactScorePercentage(totalMarks: number, maximumMarks: number) {
  return (totalMarks / maximumMarks) * 100;
}

function hasFinalScore(
  candidate: CandidatePerformance,
): candidate is CandidatePerformance & { totalMarks: number } {
  return (
    candidate.evaluationStatus === "FINALIZED" &&
    candidate.totalMarks !== null
  );
}

export function calculatePerformanceMetrics(
  candidates: CandidatePerformance[],
  enrolledCount: number,
) {
  const finalized = candidates.filter(hasFinalScore);
  const exactPercentages = finalized.map((candidate) =>
    exactScorePercentage(candidate.totalMarks, candidate.maximumMarks),
  );
  const percentages = exactPercentages.map(
    (percentage) => Math.round(percentage * 10) / 10,
  );
  const submittedCount = candidates.length;
  const publishedCount = candidates.filter(
    (candidate) =>
      candidate.evaluationStatus === "FINALIZED" && candidate.published,
  ).length;

  return {
    enrolledCount,
    submittedCount,
    participationRate:
      enrolledCount === 0
        ? null
        : Math.round((submittedCount / enrolledCount) * 1000) / 10,
    finalizedCount: finalized.length,
    publishedCount,
    averagePercentage:
      percentages.length === 0
        ? null
        : Math.round(
            (exactPercentages.reduce(
              (total, percentage) => total + percentage,
              0,
            ) /
              exactPercentages.length) *
              10,
          ) / 10,
    highestPercentage:
      exactPercentages.length === 0
        ? null
        : Math.round(
            exactPercentages.reduce(
              (highest, percentage) => Math.max(highest, percentage),
              0,
            ) * 10,
          ) / 10,
    lowestPercentage:
      exactPercentages.length === 0
        ? null
        : Math.round(
            exactPercentages.reduce(
              (lowest, percentage) => Math.min(lowest, percentage),
              100,
            ) * 10,
          ) / 10,
    highestMarks:
      finalized.length === 0
        ? null
        : finalized.reduce(
            (highest, candidate) => Math.max(highest, candidate.totalMarks),
            0,
          ),
    lowestMarks:
      finalized.length === 0
        ? null
        : finalized.reduce(
            (lowest, candidate) => Math.min(lowest, candidate.totalMarks),
            Number.MAX_SAFE_INTEGER,
          ),
    passRate: null as number | null,
    passThreshold: null as number | null,
    reportStage:
      candidates.length > 0 && publishedCount === candidates.length
        ? ("PUBLISHED_RESULTS" as const)
        : ("INTERNAL_REVIEW" as const),
    scoreDistribution: Array.from({ length: 5 }, (_, index) => {
      const minimum = index * 20;
      const maximum = (index + 1) * 20;
      return {
        label:
          index === 4
            ? `${minimum}–100%`
            : `${minimum}–<${maximum}%`,
        count: percentages.filter(
          (percentage) =>
            percentage >= minimum &&
            (index === 4 ? percentage <= 100 : percentage < maximum),
        ).length,
      };
    }),
  };
}

export type QuestionAnalytics = {
  id: string;
  prompt: string;
  type: AttemptSnapshotQuestion["type"];
  marks: number;
  responseCount: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number | null;
  correctRate: number | null;
  options: { id: string; text: string; selectionCount: number }[];
};

type AttemptQuestionResponses = {
  snapshot: AttemptSnapshot;
  answers: ReadonlyMap<string, AttemptAnswerValue | null>;
};

function isUnanswered(answer: AttemptAnswerValue | null | undefined) {
  if (answer === null || answer === undefined) return true;
  if (answer.kind === "multiple") return answer.optionIds.length === 0;
  if (answer.kind === "written") return answer.text.trim().length === 0;
  return false;
}

export function aggregateQuestionAnalytics(
  attempts: AttemptQuestionResponses[],
): QuestionAnalytics[] {
  const questions = new Map<
    string,
    QuestionAnalytics & {
      optionLabels: Map<string, string>;
      selectionCounts: Map<string, number>;
    }
  >();

  for (const attempt of attempts) {
    for (const question of attempt.snapshot.questions) {
      const key = `${question.id}:${question.type}`;
      const analytics = questions.get(key) ?? {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        marks: question.marks,
        responseCount: 0,
        answeredCount: 0,
        unansweredCount: 0,
        correctCount: question.type === "WRITTEN" ? null : 0,
        correctRate: null,
        options: [],
        optionLabels: new Map<string, string>(),
        selectionCounts: new Map<string, number>(),
      };
      const answer = attempt.answers.get(question.id) ?? null;
      analytics.responseCount += 1;
      if (isUnanswered(answer)) {
        analytics.unansweredCount += 1;
      } else {
        analytics.answeredCount += 1;
        if (analytics.correctCount !== null) {
          if (getAutomaticMarks(question, answer) === question.marks) {
            analytics.correctCount += 1;
          }
        }
      }

      for (const option of question.options) {
        analytics.optionLabels.set(option.id, option.text);
        const selected =
          (answer?.kind === "single" && answer.optionId === option.id) ||
          (answer?.kind === "multiple" &&
            answer.optionIds.includes(option.id));
        if (selected) {
          analytics.selectionCounts.set(
            option.id,
            (analytics.selectionCounts.get(option.id) ?? 0) + 1,
          );
        }
      }
      questions.set(key, analytics);
    }
  }

  return [...questions.values()].map((analytics) => {
    return {
      id: analytics.id,
      prompt: analytics.prompt,
      type: analytics.type,
      marks: analytics.marks,
      responseCount: analytics.responseCount,
      answeredCount: analytics.answeredCount,
      unansweredCount: analytics.unansweredCount,
      correctCount: analytics.correctCount,
      correctRate:
        analytics.correctCount === null || analytics.answeredCount === 0
          ? null
          : Math.round(
              (analytics.correctCount / analytics.answeredCount) * 1000,
            ) / 10,
      options: [...analytics.optionLabels.entries()].map(([id, text]) => ({
        id,
        text,
        selectionCount: analytics.selectionCounts.get(id) ?? 0,
      })),
    };
  });
}
