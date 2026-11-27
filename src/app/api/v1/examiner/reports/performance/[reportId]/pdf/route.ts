import { authorizeApi } from "@/lib/auth/authorization";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPerformanceReportPdf } from "@/lib/reports/pdf";
import { reportErrorResponse, reportPdfResponse } from "@/lib/reports/http";
import { getExaminerPerformanceReportRecord } from "@/lib/reports/service";

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
    const record = await getExaminerPerformanceReportRecord(
      authorization.user.id,
      reportId,
    );
    const verificationUrl = new URL(
      `/verify/${record.verificationToken}`,
      request.url,
    ).toString();
    const pdf = await buildPerformanceReportPdf(record.report, {
      verificationUrl,
      verificationToken: record.verificationToken,
    });
    return reportPdfResponse(pdf, `evalify-performance-${record.id}.pdf`);
  } catch (error) {
    return reportErrorResponse(error);
  }
}
