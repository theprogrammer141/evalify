import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { reportErrorResponse } from "@/lib/reports/http";
import { revokeCandidateResultReport } from "@/lib/reports/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { reportId } = await params;
  if (!z.uuid().safeParse(reportId).success) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return NextResponse.json(
      {
        report: await revokeCandidateResultReport(
          authorization.user.id,
          reportId,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}
