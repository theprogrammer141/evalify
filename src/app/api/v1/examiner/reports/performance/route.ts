import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { buildPerformanceReportPdf } from "@/lib/reports/pdf";
import { reportErrorResponse, reportPdfResponse } from "@/lib/reports/http";
import {
  getExaminerPerformanceReport,
  saveExaminerPerformanceReport,
} from "@/lib/reports/service";
import { randomBytes } from "node:crypto";

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

export async function POST(request: Request) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const parsed = z.object({ examinationId: z.uuid() }).strict().safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const report = await getExaminerPerformanceReport(
      authorization.user.id,
      parsed.data.examinationId,
    );
    const generatedAt = new Date().toISOString();
    const snapshot = { ...report, generatedAt };
    const verificationToken = randomBytes(32).toString("hex");
    const verificationUrl = new URL(
      `/verify/${verificationToken}`,
      request.url,
    ).toString();
    const pdf = await buildPerformanceReportPdf(snapshot, {
      verificationUrl,
      verificationToken,
    });
    const record = await saveExaminerPerformanceReport(
      authorization.user.id,
      verificationToken,
      snapshot,
    );

    return reportPdfResponse(
      pdf,
      `evalify-performance-${record.id}.pdf`,
      {
        "X-Evalify-Report-Id": record.id,
        "X-Evalify-Verification-Token": record.verificationToken,
        "X-Evalify-Generated-At": record.generatedAt,
        "X-Evalify-Report-Stage": snapshot.reportStage,
      },
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}
