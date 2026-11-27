import { AppShell } from "@/components/app-shell";
import { ReportCenter } from "@/components/examinations/report-center";
import { requirePageRole } from "@/lib/auth/authorization";
import { listExaminerEvaluations } from "@/lib/evaluations/service";
import {
  getExaminerPerformanceReport,
  getExaminerQuestionAnalytics,
  listExaminerPerformanceReports,
  listExaminerReportExaminations,
  listExaminerReports,
} from "@/lib/reports/service";

export const instant = false;

type PageProps = {
  searchParams: Promise<{ examinationId?: string }>;
};

export default async function ExaminerReportsPage({ searchParams }: PageProps) {
  const user = await requirePageRole("EXAMINER");
  await listExaminerEvaluations(user.id);
  const [examinations, candidateReports, query] = await Promise.all([
    listExaminerReportExaminations(user.id),
    listExaminerReports(user.id),
    searchParams,
  ]);
  const selectedExamination =
    examinations.find((examination) => examination.id === query.examinationId) ??
    examinations[0] ??
    null;
  const [performance, questionAnalytics, performanceReports] =
    selectedExamination
      ? await Promise.all([
          getExaminerPerformanceReport(user.id, selectedExamination.id),
          getExaminerQuestionAnalytics(user.id, selectedExamination.id),
          listExaminerPerformanceReports(user.id, selectedExamination.id),
        ])
      : [null, null, []];

  return (
    <AppShell user={user}>
      <ReportCenter
        candidateReports={candidateReports}
        currentExaminerEmail={user.email}
        examinations={examinations}
        performance={performance}
        performanceReports={performanceReports}
        questionAnalytics={questionAnalytics}
        selectedExaminationId={selectedExamination?.id ?? null}
      />
    </AppShell>
  );
}
