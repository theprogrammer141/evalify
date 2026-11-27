import assert from "node:assert/strict";
import test from "node:test";
import {
  examinationSchema,
  getAvailabilityState,
  getPublicationIssues,
  isWithinAvailabilityWindow,
  questionSchema,
} from "@/lib/examinations/validation";

const optionOne = "00000000-0000-4000-8000-000000000001";
const optionTwo = "00000000-0000-4000-8000-000000000002";

const objectiveQuestion = {
  prompt: "Which value is even?",
  category: "Arithmetic",
  difficulty: "EASY" as const,
  marks: 2,
  type: "SINGLE_CHOICE" as const,
  options: [
    { id: optionOne, text: "3" },
    { id: optionTwo, text: "4" },
  ],
  answerKey: [optionTwo],
};

test("question validation accepts each supported question type", () => {
  assert.equal(questionSchema.safeParse(objectiveQuestion).success, true);
  assert.equal(
    questionSchema.safeParse({
      ...objectiveQuestion,
      type: "MULTIPLE_SELECT",
      answerKey: [optionOne, optionTwo],
    }).success,
    true,
  );
  assert.equal(
    questionSchema.safeParse({
      prompt: "Show your working.",
      category: "Arithmetic",
      difficulty: "MEDIUM",
      marks: 5,
      type: "WRITTEN_RESPONSE",
      options: [],
      answerKey: [],
    }).success,
    true,
  );
});

test("objective question keys must be valid options for their question type", () => {
  assert.equal(
    questionSchema.safeParse({ ...objectiveQuestion, answerKey: [] }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({
      ...objectiveQuestion,
      type: "MULTIPLE_SELECT",
      answerKey: ["00000000-0000-4000-8000-000000000003"],
    }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({
      ...objectiveQuestion,
      options: [
        { id: optionOne, text: "3" },
        { id: optionOne, text: "4" },
      ],
    }).success,
    false,
  );
});

test("examination validation requires an ordered schedule and positive duration", () => {
  const examination = {
    title: "Regional mathematics",
    instructions: "Read each question before answering.",
    startsAt: "2027-01-01T10:00:00.000Z",
    endsAt: "2027-01-01T12:00:00.000Z",
    durationMinutes: 60,
    randomizeQuestions: false,
    randomizeOptions: false,
  };

  const parsedExamination = examinationSchema.safeParse(examination);
  assert.equal(parsedExamination.success, true);
  if (parsedExamination.success) {
    assert.equal("totalMarks" in parsedExamination.data, false);
  }
  assert.equal(
    examinationSchema.safeParse({ ...examination, totalMarks: 99999 }).success,
    true,
  );
  assert.equal(
    examinationSchema.safeParse({
      ...examination,
      endsAt: examination.startsAt,
    }).success,
    false,
  );
  assert.equal(
    examinationSchema.safeParse({ ...examination, durationMinutes: 0 }).success,
    false,
  );
});

test("publication reports every missing requirement and an expired schedule", () => {
  const issues = getPublicationIssues(
    {
      title: "",
      instructions: "",
      startsAt: new Date("2026-01-01T10:00:00.000Z"),
      endsAt: new Date("2026-01-01T12:00:00.000Z"),
      durationMinutes: 0,
      questionCount: 0,
      candidateCount: 0,
    },
    new Date("2026-02-01T00:00:00.000Z"),
  );

  assert.equal(issues.length, 6);
  assert.match(issues[0], /title/i);
  assert.match(issues[1], /instructions/i);
  assert.match(issues[2], /duration/i);
  assert.match(issues[3], /ended/i);
  assert.match(issues[4], /question/i);
  assert.match(issues[5], /candidate/i);
});

test("availability is derived from server time and published status", () => {
  const start = new Date("2027-01-01T10:00:00.000Z");
  const end = new Date("2027-01-01T12:00:00.000Z");

  assert.equal(
    getAvailabilityState("DRAFT", start, end, new Date("2027-01-01T11:00:00Z")),
    "draft",
  );
  assert.equal(
    getAvailabilityState("PUBLISHED", start, end, new Date("2026-12-31T23:00:00Z")),
    "upcoming",
  );
  assert.equal(
    getAvailabilityState("PUBLISHED", start, end, new Date("2027-01-01T10:00:00Z")),
    "ongoing",
  );
  assert.equal(
    getAvailabilityState("PUBLISHED", start, end, end),
    "completed",
  );
});

test("candidate availability opens at the start and closes at the end", () => {
  const start = new Date("2027-01-01T10:00:00.000Z");
  const end = new Date("2027-01-01T12:00:00.000Z");

  assert.equal(
    isWithinAvailabilityWindow(start, end, new Date(start.getTime() - 1)),
    false,
  );
  assert.equal(isWithinAvailabilityWindow(start, end, start), true);
  assert.equal(
    isWithinAvailabilityWindow(start, end, new Date(end.getTime() - 1)),
    true,
  );
  assert.equal(isWithinAvailabilityWindow(start, end, end), false);
});