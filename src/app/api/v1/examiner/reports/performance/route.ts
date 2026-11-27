import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { buildPerformanceReportPdf } from "@/lib/reports/pdf";
import { reportErrorResponse, reportPdfResponse } from "@/lib/reports/http";
import { getExaminerPerformanceReport } from "@/lib/reports/service";

export async function GET(request: Request) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const examinationId = new URL(request.url).searchParams.get("examinationId");
  if (!z.uuid().safeParse(examinationId).success) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const report = await getExaminerPerformanceReport(
      authorization.user.id,
      examinationId as string,
    );
    const pdf = await buildPerformanceReportPdf(report);
    return reportPdfResponse(
      pdf,
      `evalify-performance-${report.id}.pdf`,
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}
