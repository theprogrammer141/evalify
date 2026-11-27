import { z } from "zod";

export const issuedReportSnapshotSchema = z
  .object({
    examinationTitle: z.string().min(1).max(240),
    candidateEmail: z.email(),
    opensAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    durationMinutes: z.number().int().positive(),
    attemptStatus: z.enum(["SUBMITTED", "EXPIRED"]),
    completedAt: z.iso.datetime(),
    totalMarks: z.number().int().nonnegative(),
    autoMarks: z.number().int().nonnegative(),
    manualMarks: z.number().int().nonnegative(),
    maximumMarks: z.number().int().positive(),
    publishedAt: z.iso.datetime(),
  })
  .strict()
  .refine((snapshot) => snapshot.totalMarks <= snapshot.maximumMarks);

export type IssuedReportSnapshot = z.infer<
  typeof issuedReportSnapshotSchema
>;

const performanceCandidateSchema = z.object({
  candidateEmail: z.email(),
  attemptStatus: z.enum(["SUBMITTED", "EXPIRED"]),
  completedAt: z.iso.datetime().nullable(),
  evaluationStatus: z.enum([
    "AUTO_GRADED",
    "AWAITING_MANUAL",
    "PARTIALLY_EVALUATED",
    "COMPLETED",
    "FINALIZED",
  ]).nullable(),
  totalMarks: z.number().int().nonnegative().nullable(),
  autoMarks: z.number().int().nonnegative().nullable(),
  manualMarks: z.number().int().nonnegative().nullable(),
  maximumMarks: z.number().int().positive(),
  published: z.boolean(),
  percentage: z.number().min(0).max(100).nullable(),
}).strict();

export const performanceReportSnapshotSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(240),
  opensAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  generatedAt: z.iso.datetime(),
  enrolledCount: z.number().int().nonnegative(),
  submittedCount: z.number().int().nonnegative(),
  participationRate: z.number().min(0).max(100).nullable(),
  finalizedCount: z.number().int().nonnegative(),
  publishedCount: z.number().int().nonnegative(),
  averagePercentage: z.number().min(0).max(100).nullable(),
  highestPercentage: z.number().min(0).max(100).nullable(),
  lowestPercentage: z.number().min(0).max(100).nullable(),
  highestMarks: z.number().int().nonnegative().nullable(),
  lowestMarks: z.number().int().nonnegative().nullable(),
  passRate: z.number().min(0).max(100).nullable(),
  passThreshold: z.number().min(0).max(100).nullable(),
  reportStage: z.enum(["INTERNAL_REVIEW", "PUBLISHED_RESULTS"]),
  scoreDistribution: z.array(z.object({
    label: z.string(),
    count: z.number().int().nonnegative(),
  }).strict()).length(5),
  candidates: z.array(performanceCandidateSchema),
}).strict();

export type PerformanceReportSnapshot = z.infer<
  typeof performanceReportSnapshotSchema
>;
