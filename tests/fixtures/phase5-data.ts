import { randomBytes, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { connectPostgresSocket } from "@/lib/db/socket";

type TestQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "WRITTEN_RESPONSE";
  prompt: string;
  options: { id: string; text: string }[];
  markingRules: Record<string, unknown>;
};

export type Phase5Fixture = {
  candidateEmail: string;
  candidatePassword: string;
  otherCandidateEmail: string;
  otherCandidatePassword: string;
  examinationIds: {
    primary: string;
    followup: string;
    upcoming: string;
    unassigned: string;
    expiry: string;
  };
  examinationTitles: {
    primary: string;
    followup: string;
    upcoming: string;
    unassigned: string;
    expiry: string;
  };
  questionIds: {
    single: string;
    multiple: string;
    written: string;
    unanswered: string;
  };
  markingMarker: string;
  optionIds: {
    singleCorrect: string;
    singleAlternate: string;
    multipleFirst: string;
    multipleSecond: string;
  };
  cronSecret: string | undefined;
  setAttemptExpiry(attemptId: string, secondsFromNow: number): Promise<string>;
  cleanup(): Promise<void>;
};

export async function createPhase5Fixture(): Promise<Phase5Fixture> {
  loadEnvConfig(process.cwd());
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Phase 5 Playwright acceptance requires DATABASE_URL.");
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    prepare: false,
    ssl: "require",
    socket: connectPostgresSocket,
  });
  const runId = randomUUID();
  const markingMarker = `private-marking-marker-${runId}`;
  const examinerId = randomUUID();
  const candidateId = randomUUID();
  const otherCandidateId = randomUUID();
  const candidatePassword = randomBytes(24).toString("base64url");
  const otherCandidatePassword = randomBytes(24).toString("base64url");
  const candidateEmail = `phase5-${runId}@example.test`;
  const otherCandidateEmail = `phase5-other-${runId}@example.test`;
  const passwords = [
    { email: candidateEmail, password: candidatePassword },
    { email: otherCandidateEmail, password: otherCandidatePassword },
  ];
  const passwordHashes = await Promise.all(
    passwords.map(({ password }) => bcrypt.hash(password, 4)),
  );
  const now = new Date();
  const opensAt = new Date(now.getTime() - 60_000);
  const closesAt = new Date(now.getTime() + 4 * 60 * 60_000);

  const questions: TestQuestion[] = [
    {
      id: randomUUID(),
      type: "SINGLE_CHOICE",
      prompt: `Phase 5 single choice ${runId}`,
      options: [
        { id: randomUUID(), text: "Single choice first option" },
        { id: randomUUID(), text: "Single choice second option" },
      ],
      markingRules: {
        correctOptionId: "",
        examinerNote: markingMarker,
      },
    },
    {
      id: randomUUID(),
      type: "MULTIPLE_SELECT",
      prompt: `Phase 5 multiple select ${runId}`,
      options: [
        { id: randomUUID(), text: "Multiple choice first option" },
        { id: randomUUID(), text: "Multiple choice second option" },
      ],
      markingRules: {
        correctOptionIds: [],
        examinerNote: markingMarker,
      },
    },
    {
      id: randomUUID(),
      type: "WRITTEN_RESPONSE",
      prompt: `Phase 5 written response ${runId}`,
      options: [],
      markingRules: { rubric: markingMarker },
    },
    {
      id: randomUUID(),
      type: "SINGLE_CHOICE",
      prompt: `Phase 5 unanswered question ${runId}`,
      options: [
        { id: randomUUID(), text: "Unanswered first option" },
        { id: randomUUID(), text: "Unanswered second option" },
      ],
      markingRules: {
        correctOptionId: "",
        examinerNote: markingMarker,
      },
    },
  ];
  questions[0].markingRules.correctOptionId = questions[0].options[0].id;
  questions[1].markingRules.correctOptionIds = [
    questions[1].options[0].id,
    questions[1].options[1].id,
  ];
  questions[3].markingRules.correctOptionId = questions[3].options[0].id;

  const examinationIds = {
    primary: randomUUID(),
    followup: randomUUID(),
    upcoming: randomUUID(),
    unassigned: randomUUID(),
    expiry: randomUUID(),
  };
  const examinationTitles = {
    primary: `Phase 5 delivery ${runId}`,
    followup: `Phase 5 preferences ${runId}`,
    upcoming: `Phase 5 upcoming ${runId}`,
    unassigned: `Phase 5 unassigned ${runId}`,
    expiry: `Phase 5 expiry ${runId}`,
  };
  const availableExaminations = [
    "primary",
    "followup",
    "expiry",
  ] as const;
  const upcomingOpensAt = new Date(now.getTime() + 60 * 60_000);
  const futureExamClosesAt = new Date(now.getTime() + 4 * 60 * 60_000);
  const users = [
    {
      id: examinerId,
      email: `phase5-examiner-${runId}@example.test`,
      passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 4),
      role: "EXAMINER",
    },
    {
      id: candidateId,
      email: candidateEmail,
      passwordHash: passwordHashes[0],
      role: "CANDIDATE",
    },
    {
      id: otherCandidateId,
      email: otherCandidateEmail,
      passwordHash: passwordHashes[1],
      role: "CANDIDATE",
    },
  ];

  try {
    await sql.begin(async (transaction) => {
      for (const user of users) {
        await transaction`
          INSERT INTO users (id, email, password_hash, role)
          VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.role})
        `;
      }

      for (const question of questions) {
        await transaction`
          INSERT INTO questions (
            id, examiner_id, type, prompt, category, difficulty, options,
            marks, marking_rules
          )
          VALUES (
            ${question.id}, ${examinerId}, ${question.type}, ${question.prompt},
            'Phase 5', 'MEDIUM', ${transaction.json(question.options)}::jsonb, 1,
            ${transaction.json(question.markingRules)}::jsonb
          )
        `;
      }

      for (const [key, examinationId] of Object.entries(examinationIds)) {
        const isUpcoming = key === "upcoming";
        const opens = isUpcoming ? upcomingOpensAt : opensAt;
        const closes = isUpcoming ? futureExamClosesAt : closesAt;
        await transaction`
          INSERT INTO examinations (
            id, examiner_id, title, instructions, status, total_marks,
            published_at, opens_at, closes_at, duration_minutes,
            randomize_questions, randomize_options
          )
          VALUES (
            ${examinationId}, ${examinerId}, ${examinationTitles[key as keyof typeof examinationTitles]},
            ${`Read each question carefully. Phase 5 test reference ${runId}.`},
            'PUBLISHED', 4, ${now}, ${opens}, ${closes}, 60, false, false
          )
        `;

        for (const [position, question] of questions.entries()) {
          await transaction`
            INSERT INTO examination_questions (
              examination_id, question_id, position, marks
            )
            VALUES (${examinationId}, ${question.id}, ${position + 1}, 1)
          `;
        }

        if (
          availableExaminations.includes(
            key as (typeof availableExaminations)[number],
          ) ||
          isUpcoming
        ) {
          await transaction`
            INSERT INTO enrollments (examination_id, candidate_id, status)
            VALUES (${examinationId}, ${candidateId}, 'ENROLLED')
          `;
          await transaction`
            INSERT INTO examination_enrollments (examination_id, candidate_id)
            VALUES (${examinationId}, ${candidateId})
          `;
        }
      }
    });
  } catch (error) {
    await sql.end();
    throw error;
  }

  let cleaned = false;
  return {
    candidateEmail,
    candidatePassword,
    otherCandidateEmail,
    otherCandidatePassword,
    examinationIds,
    examinationTitles,
    questionIds: {
      single: questions[0].id,
      multiple: questions[1].id,
      written: questions[2].id,
      unanswered: questions[3].id,
    },
    markingMarker,
    optionIds: {
      singleCorrect: questions[0].options[0].id,
      singleAlternate: questions[0].options[1].id,
      multipleFirst: questions[1].options[0].id,
      multipleSecond: questions[1].options[1].id,
    },
    cronSecret: process.env.CRON_SECRET,
    async setAttemptExpiry(attemptId, secondsFromNow) {
      const [updated] = await sql`
        UPDATE attempts
        SET expires_at = clock_timestamp() + make_interval(secs => ${secondsFromNow})
        WHERE id = ${attemptId}
        RETURNING expires_at
      `;
      if (!updated) throw new Error("Could not shorten the test attempt deadline.");
      return updated.expires_at.toISOString();
    },
    async cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        await sql.begin(async (transaction) => {
          await transaction`
            DELETE FROM attempts
            WHERE examination_id = ANY(${Object.values(examinationIds)}::uuid[])
          `;
          await transaction`
            DELETE FROM examinations
            WHERE id = ANY(${Object.values(examinationIds)}::uuid[])
          `;
          await transaction`
            DELETE FROM questions
            WHERE id = ANY(${questions.map(({ id }) => id)}::uuid[])
          `;
          await transaction`
            DELETE FROM users
            WHERE id = ANY(${[examinerId, candidateId, otherCandidateId]}::uuid[])
          `;
        });
      } finally {
        await sql.end();
      }
    },
  };
}
