import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CandidateExaminationDetail } from "@/components/examinations/candidate-examination-list";
import { requirePageRole } from "@/lib/auth/authorization";
import { getCandidateExamination } from "@/lib/examinations/service";

export const instant = false;

type PageProps = { params: Promise<{ id: string }> };

export default async function CandidateExaminationPage({
  params,
}: PageProps) {
  const user = await requirePageRole("CANDIDATE");
  const { id } = await params;
  const examination = await getCandidateExamination(user.id, id);
  if (!examination) notFound();

  return (
    <AppShell user={user}>
      <CandidateExaminationDetail examination={examination} />
    </AppShell>
  );
}