import assert from "node:assert/strict";
import test from "node:test";
import { issuedReportSnapshotSchema } from "@/lib/reports/validation";

const validSnapshot = {
  examinationTitle: "Assessment",
  candidateEmail: "candidate@example.test",
  opensAt: "2026-01-01T09:00:00.000Z",
  closesAt: "2026-01-01T12:00:00.000Z",
  durationMinutes: 180,
  attemptStatus: "SUBMITTED",
  completedAt: "2026-01-01T11:00:00.000Z",
  totalMarks: 42,
  autoMarks: 27,
  manualMarks: 15,
  maximumMarks: 50,
  publishedAt: "2026-01-02T08:30:00.000Z",
};

test("issued report snapshots preserve only complete, bounded published results", () => {
  assert.equal(issuedReportSnapshotSchema.safeParse(validSnapshot).success, true);
  assert.equal(
    issuedReportSnapshotSchema.safeParse({
      ...validSnapshot,
      totalMarks: 51,
    }).success,
    false,
  );
  assert.equal(
    issuedReportSnapshotSchema.safeParse({
      ...validSnapshot,
      attemptStatus: "IN_PROGRESS",
    }).success,
    false,
  );
  assert.equal(
    issuedReportSnapshotSchema.safeParse({
      ...validSnapshot,
      answers: ["must not be copied into an issued report"],
    }).success,
    false,
  );
});
