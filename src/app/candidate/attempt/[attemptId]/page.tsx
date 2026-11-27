import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttemptWorkspace } from "@/components/candidate/attempt-workspace";
import { requirePageRole } from "@/lib/auth/authorization";
import {
  AttemptServiceError,
  getCandidateAttempt,
} from "@/lib/attempts/service";

export const instant = false;

export default async function CandidateAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requirePageRole("CANDIDATE");
  const { attemptId } = await params;
  let attempt;

  try {
    attempt = await getCandidateAttempt(user.id, attemptId);
  } catch (error) {
    if (
      error instanceof AttemptServiceError &&
      error.code === "not_found"
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <AppShell user={user}>
      <AttemptWorkspace candidateId={user.id} initialAttempt={attempt} />
    </AppShell>
  );
}
