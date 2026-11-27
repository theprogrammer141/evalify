import assert from "node:assert/strict";
import test from "node:test";
import {
  issuedReportSnapshotSchema,
  performanceReportSnapshotSchema,
} from "@/lib/reports/validation";

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

test("performance report snapshots exclude response content and preserve publication state", () => {
  const performanceSnapshot = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Assessment",
    opensAt: "2026-01-01T09:00:00.000Z",
    closesAt: "2026-01-01T12:00:00.000Z",
    durationMinutes: 180,
    generatedAt: "2026-01-02T09:00:00.000Z",
    enrolledCount: 2,
    submittedCount: 1,
    participationRate: 50,
    finalizedCount: 1,
    publishedCount: 1,
    averagePercentage: 80,
    highestPercentage: 80,
    lowestPercentage: 80,
    highestMarks: 40,
    lowestMarks: 40,
    passRate: null,
    passThreshold: null,
    reportStage: "PUBLISHED_RESULTS",
    scoreDistribution: [
      { label: "0–<20%", count: 0 },
      { label: "20–<40%", count: 0 },
      { label: "40–<60%", count: 0 },
      { label: "60–<80%", count: 0 },
      { label: "80–100%", count: 1 },
    ],
    candidates: [{
      candidateEmail: "candidate@example.test",
      attemptStatus: "SUBMITTED",
      completedAt: "2026-01-01T11:00:00.000Z",
      evaluationStatus: "FINALIZED",
      totalMarks: 40,
      autoMarks: 25,
      manualMarks: 15,
      maximumMarks: 50,
      published: true,
      percentage: 80,
    }],
  };

  assert.equal(
    performanceReportSnapshotSchema.safeParse(performanceSnapshot).success,
    true,
  );
  assert.equal(
    performanceReportSnapshotSchema.safeParse({
      ...performanceSnapshot,
      candidates: [{
        ...performanceSnapshot.candidates[0],
        answers: ["candidate response"],
      }],
    }).success,
    false,
  );
});
