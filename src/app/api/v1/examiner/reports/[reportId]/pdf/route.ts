import { authorizeApi } from "@/lib/auth/authorization";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCandidateResultReportPdf } from "@/lib/reports/pdf";
import { reportErrorResponse, reportPdfResponse } from "@/lib/reports/http";
import { getExaminerIssuedReport } from "@/lib/reports/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { reportId } = await params;
  if (!z.uuid().safeParse(reportId).success) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const report = await getExaminerIssuedReport(authorization.user.id, reportId);
    const verificationUrl = new URL(
      report.verificationUrl,
      request.url,
    ).toString();
    const pdf = await buildCandidateResultReportPdf(report, verificationUrl);
    return reportPdfResponse(pdf, `evalify-result-${report.id}.pdf`);
  } catch (error) {
    return reportErrorResponse(error);
  }
}
