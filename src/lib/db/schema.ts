import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  AttemptAnswerValue,
  AttemptSnapshot,
  MarkingRules,
} from "@/lib/attempts/types";

export const userRole = pgEnum("user_role", [
  "ADMIN",
  "EXAMINER",
  "CANDIDATE",
]);

export const examinationStatus = pgEnum("examination_status", [
  "DRAFT",
  "PUBLISHED",
  "COMPLETED",
]);

export const questionType = pgEnum("question_type", [
  "SINGLE_CHOICE",
  "MULTIPLE_SELECT",
  "WRITTEN_RESPONSE",
  "WRITTEN",
]);

export const questionDifficulty = pgEnum("question_difficulty", [
  "EASY",
  "MEDIUM",
  "HARD",
]);

export const attemptStatus = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "SUBMITTED",
  "EXPIRED",
]);

export const monitoringEventType = pgEnum("monitoring_event_type", [
  "CONNECTION_INTERRUPTION",
  "CONNECTION_RESTORED",
  "SAVE_FAILURE",
  "BROWSER_HIDDEN",
]);

export type UserRole = (typeof userRole.enumValues)[number];
export type QuestionType = (typeof questionType.enumValues)[number];
export type QuestionDifficulty = (typeof questionDifficulty.enumValues)[number];
export type AttemptStatus = (typeof attemptStatus.enumValues)[number];
export type MonitoringEventType =
  (typeof monitoringEventType.enumValues)[number];

export type QuestionOption = {
  id: string;
  text: string;
};

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

export const enrollmentStatus = pgEnum("enrollment_status", [
  "ENROLLED",
  "WITHDRAWN",
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
    totalMarks: integer("total_marks").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    randomizeQuestions: boolean("randomize_questions").notNull().default(false),
    randomizeOptions: boolean("randomize_options").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
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
    category: varchar("category", { length: 120 }).notNull().default(""),
    difficulty: questionDifficulty("difficulty").notNull().default("MEDIUM"),
    options: jsonb("options").$type<QuestionOption[]>().notNull().default([]),
    marks: integer("marks").notNull(),
    markingRules: jsonb("marking_rules")
      .$type<MarkingRules>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
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
    enrolledAt: timestamp("created_at", { withTimezone: true })
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

export const examinationEnrollments = pgTable(
  "examination_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("examination_enrollments_candidate_unique").on(
      table.examinationId,
      table.candidateId,
    ),
    index("examination_enrollments_candidate_idx").on(table.candidateId),
  ],
);

export const examinationAttempts = pgTable(
  "examination_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: attemptStatus("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("examination_attempt_candidate_unique").on(
      table.examinationId,
      table.candidateId,
    ),
    uniqueIndex("examination_attempt_identity_unique").on(
      table.id,
      table.examinationId,
      table.candidateId,
    ),
    index("examination_attempt_examination_status_idx").on(
      table.examinationId,
      table.status,
    ),
    index("examination_attempt_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.status} = 'IN_PROGRESS'`),
    check(
      "examination_attempt_deadline_ordered",
      sql`${table.expiresAt} > ${table.startedAt}`,
    ),
    check(
      "examination_attempt_final_state_consistent",
      sql`(${table.status} = 'IN_PROGRESS' AND ${table.submittedAt} IS NULL AND ${table.finalizedAt} IS NULL) OR (${table.status} = 'SUBMITTED' AND ${table.submittedAt} IS NOT NULL AND ${table.finalizedAt} IS NOT NULL) OR (${table.status} = 'EXPIRED' AND ${table.submittedAt} IS NULL AND ${table.finalizedAt} IS NOT NULL)`,
    ),
    foreignKey({
      name: "examination_attempt_enrollment_fk",
      columns: [table.examinationId, table.candidateId],
      foreignColumns: [
        examinationEnrollments.examinationId,
        examinationEnrollments.candidateId,
      ],
    }).onDelete("cascade"),
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
    snapshot: jsonb("snapshot").$type<AttemptSnapshot>().notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
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

export const attemptQuestions = pgTable(
  "attempt_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => examinationAttempts.id, { onDelete: "cascade" }),
    sourceAssignmentId: uuid("source_assignment_id").notNull(),
    position: integer("position").notNull(),
    prompt: varchar("prompt", { length: 8000 }).notNull(),
    type: questionType("type").notNull(),
    marks: integer("marks").notNull(),
    options: jsonb("options").$type<QuestionOption[]>().notNull().default([]),
    answerKey: jsonb("answer_key").$type<string[]>().notNull().default([]),
  },
  (table) => [
    uniqueIndex("attempt_questions_position_unique").on(
      table.attemptId,
      table.position,
    ),
    uniqueIndex("attempt_questions_identity_unique").on(
      table.id,
      table.attemptId,
    ),
    index("attempt_questions_attempt_idx").on(table.attemptId),
  ],
);

export type AttemptResponse =
  | { type: "options"; optionIds: string[] }
  | { type: "text"; text: string };

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
            and (${table.answer} - 'kind' - 'optionId') = '{}'::jsonb
            and jsonb_typeof(${table.answer}->'optionId') = 'string'
            and (${table.answer}->>'optionId') <> ''
          ) or (
            ${table.answer}->>'kind' = 'multiple'
            and (${table.answer} - 'kind' - 'optionIds') = '{}'::jsonb
            and jsonb_typeof(${table.answer}->'optionIds') = 'array'
            and not jsonb_path_exists(
              ${table.answer},
              '$.optionIds[*] ? (@.type() != "string")'
            )
          ) or (
            ${table.answer}->>'kind' = 'written'
            and (${table.answer} - 'kind' - 'text') = '{}'::jsonb
            and jsonb_typeof(${table.answer}->'text') = 'string'
          )
        )
      )`,
    ),
  ],
);

export const examinationAttemptAnswers = pgTable(
  "examination_attempt_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => examinationAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull(),
    response: jsonb("response").$type<AttemptResponse>().notNull(),
    markedForReview: boolean("marked_for_review").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("examination_attempt_answers_question_unique").on(
      table.questionId,
    ),
    index("examination_attempt_answers_attempt_idx").on(table.attemptId),
    foreignKey({
      name: "examination_attempt_answers_question_attempt_fk",
      columns: [table.questionId, table.attemptId],
      foreignColumns: [attemptQuestions.id, attemptQuestions.attemptId],
    }).onDelete("cascade"),
  ],
);

export const monitoringEvents = pgTable(
  "monitoring_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => examinationAttempts.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: monitoringEventType("type").notNull(),
    context: varchar("context", { length: 500 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("monitoring_events_examination_recorded_idx").on(
      table.examinationId,
      table.recordedAt,
    ),
    index("monitoring_events_candidate_recorded_idx").on(
      table.candidateId,
      table.recordedAt,
    ),
    foreignKey({
      name: "monitoring_events_attempt_relationship_fk",
      columns: [table.attemptId, table.examinationId, table.candidateId],
      foreignColumns: [
        examinationAttempts.id,
        examinationAttempts.examinationId,
        examinationAttempts.candidateId,
      ],
    }).onDelete("cascade"),
  ],
);

export const examinationAnnouncements = pgTable(
  "examination_announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examinationId: uuid("examination_id")
      .notNull()
      .references(() => examinations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: varchar("body", { length: 2000 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("examination_announcements_history_idx").on(
      table.examinationId,
      table.publishedAt,
    ),
  ],
);

export const announcementReads = pgTable(
  "announcement_reads",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => examinationAnnouncements.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("announcement_reads_candidate_unique").on(
      table.announcementId,
      table.candidateId,
    ),
  ],
);

export type DbQuestionType = QuestionType;
