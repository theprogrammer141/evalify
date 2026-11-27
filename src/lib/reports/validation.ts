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
