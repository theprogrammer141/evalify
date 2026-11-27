import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/auth/authorization";
import { reportErrorResponse } from "@/lib/reports/http";
import {
  issueCandidateResultReport,
  listExaminerReports,
} from "@/lib/reports/service";

const issueSchema = z.object({ attemptId: z.uuid() }).strict();

export async function GET() {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  return NextResponse.json(
    { examinations: await listExaminerReports(authorization.user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const parsed = issueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return NextResponse.json(
      {
        report: await issueCandidateResultReport(
          authorization.user.id,
          parsed.data.attemptId,
        ),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return reportErrorResponse(error);
  }
}
