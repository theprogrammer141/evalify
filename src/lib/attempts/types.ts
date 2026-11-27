export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "WRITTEN";

export type QuestionOption = {
  id: string;
  text: string;
};

export type MarkingRules = Record<string, unknown>;

export type AttemptSnapshotQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  marks: number;
  position: number;
  options: QuestionOption[];
  markingRules: MarkingRules;
};

export type AttemptSnapshot = {
  examTitle: string;
  instructions: string;
  questions: AttemptSnapshotQuestion[];
};

export type AttemptAnswerValue =
  | { kind: "single"; optionId: string }
  | { kind: "multiple"; optionIds: string[] }
  | { kind: "written"; text: string };

export type CandidateQuestion = Omit<
  AttemptSnapshotQuestion,
  "markingRules"
> & {
  answer: AttemptAnswerValue | null;
  markedForReview: boolean;
  revision: number;
};

export type CandidateAttempt = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  examTitle: string;
  instructions: string;
  startedAt: string;
  expiresAt: string;
  finalizedAt: string | null;
  serverNow: string;
  questions: CandidateQuestion[];
};
