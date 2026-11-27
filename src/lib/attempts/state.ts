import type { AttemptAnswerValue } from "@/lib/attempts/types";

type FinalizationRequest =
  | { kind: "deadline"; receivedAt?: Date }
  | { kind: "submission"; receivedAt: Date };

export function getFinalizedAttemptStatus(
  expiresAt: Date,
  now: Date,
  request: FinalizationRequest,
): "SUBMITTED" | "EXPIRED" | null {
  if (request.kind === "submission") {
    return request.receivedAt >= expiresAt ? "EXPIRED" : "SUBMITTED";
  }

  return expiresAt <= now ||
    (request.receivedAt !== undefined && request.receivedAt >= expiresAt)
    ? "EXPIRED"
    : null;
}

export function getAnswerRevisionDecision(input: {
  storedRevision: number;
  incomingRevision: number;
  storedAnswer: AttemptAnswerValue | null;
  incomingAnswer: AttemptAnswerValue | null;
  storedMarkedForReview: boolean;
  incomingMarkedForReview: boolean;
}): "stale" | "idempotent" | "accept" {
  if (input.incomingRevision < input.storedRevision) return "stale";
  if (input.incomingRevision > input.storedRevision) return "accept";

  const sameAnswer =
    JSON.stringify(input.storedAnswer) ===
    JSON.stringify(input.incomingAnswer);
  return sameAnswer &&
    input.storedMarkedForReview === input.incomingMarkedForReview
    ? "idempotent"
    : "stale";
}
