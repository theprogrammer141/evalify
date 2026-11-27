import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  AttemptAnswerValue,
  AttemptSnapshot,
  MarkingRules,
  QuestionOption,
  QuestionType,
} from "@/lib/attempts/types";

export const userRole = pgEnum("user_role", [
  "ADMIN",
  "EXAMINER",
  "CANDIDATE",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(),
  role: userRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const questionType = pgEnum("question_type", [
  "SINGLE_CHOICE",
  "MULTIPLE_SELECT",
  "WRITTEN",
]);

export const examinationStatus = pgEnum("examination_status", [
  "DRAFT",
  "PUBLISHED",
  "COMPLETED",
]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "ENROLLED",
  "WITHDRAWN",
]);

export const attemptStatus = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "SUBMITTED",
  "EXPIRED",
]);

export const examinations = pgTable(
  "examinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinerId: uuid("examiner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 240 }).notNull(),
    instructions: text("instructions").notNull().default(""),
    status: examinationStatus("status").notNull().default("DRAFT"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    randomizeQuestions: boolean("randomize_questions").notNull().default(false),
    randomizeOptions: boolean("randomize_options").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("examinations_examiner_id_idx").on(table.examinerId),
    check(
      "examinations_duration_positive",
      sql`${table.durationMinutes} > 0`,
    ),
    check("examinations_window_valid", sql`${table.closesAt} > ${table.opensAt}`),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinerId: uuid("examiner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: questionType("type").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<QuestionOption[]>().notNull().default([]),
    marks: integer("marks").notNull(),
    markingRules: jsonb("marking_rules")
      .$type<MarkingRules>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("questions_examiner_id_idx").on(table.examinerId),
    check("questions_marks_positive", sql`${table.marks} > 0`),
    check(
      "questions_options_array",
      sql`jsonb_typeof(${table.options}) = 'array'`,
    ),
    check(
      "questions_marking_rules_object",
      sql`jsonb_typeof(${table.markingRules}) = 'object'`,
    ),
  ],
);

export const examinationQuestions = pgTable(
  "examination_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull(),
    marks: integer("marks").notNull(),
  },
  (table) => [
    unique("examination_questions_position_unique").on(
      table.examinationId,
      table.position,
    ),
    unique("examination_questions_question_unique").on(
      table.examinationId,
      table.questionId,
    ),
    check(
      "examination_questions_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
    check("examination_questions_marks_positive", sql`${table.marks} > 0`),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("ENROLLED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("enrollments_examination_candidate_unique").on(
      table.examinationId,
      table.candidateId,
    ),
    index("enrollments_candidate_id_idx").on(table.candidateId),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "restrict" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: attemptStatus("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    snapshot: jsonb("snapshot").$type<AttemptSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("attempts_examination_candidate_unique").on(
      table.examinationId,
      table.candidateId,
    ),
    index("attempts_candidate_id_idx").on(table.candidateId),
    index("attempts_examination_id_idx").on(table.examinationId),
    index("attempts_status_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
    check("attempts_deadline_valid", sql`${table.expiresAt} > ${table.startedAt}`),
    check(
      "attempts_snapshot_object",
      sql`jsonb_typeof(${table.snapshot}) = 'object'`,
    ),
    check(
      "attempts_finalization_consistent",
      sql`(
        (${table.status} = 'IN_PROGRESS' and ${table.finalizedAt} is null) or
        (${table.status} in ('SUBMITTED', 'EXPIRED') and ${table.finalizedAt} is not null)
      )`,
    ),
  ],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    snapshotQuestionId: uuid("snapshot_question_id").notNull(),
    answer: jsonb("answer").$type<AttemptAnswerValue | null>(),
    markedForReview: boolean("marked_for_review").notNull().default(false),
    revision: integer("revision").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("attempt_answers_attempt_question_unique").on(
      table.attemptId,
      table.snapshotQuestionId,
    ),
    index("attempt_answers_attempt_id_idx").on(table.attemptId),
    check(
      "attempt_answers_revision_nonnegative",
      sql`${table.revision} >= 0`,
    ),
    check(
      "attempt_answers_shape_valid",
      sql`${table.answer} is null or (
        jsonb_typeof(${table.answer}) = 'object' and (
          (
            ${table.answer}->>'kind' = 'single'
            and jsonb_object_length(${table.answer}) = 2
            and jsonb_typeof(${table.answer}->'optionId') = 'string'
            and (${table.answer}->>'optionId') <> ''
          ) or (
            ${table.answer}->>'kind' = 'multiple'
            and jsonb_object_length(${table.answer}) = 2
            and jsonb_typeof(${table.answer}->'optionIds') = 'array'
            and not jsonb_path_exists(
              ${table.answer},
              '$.optionIds[*] ? (@.type() != "string")'
            )
          ) or (
            ${table.answer}->>'kind' = 'written'
            and jsonb_object_length(${table.answer}) = 2
            and jsonb_typeof(${table.answer}->'text') = 'string'
          )
        )
      )`,
    ),
  ],
);

export type UserRole = (typeof userRole.enumValues)[number];
export type DbQuestionType = QuestionType;
