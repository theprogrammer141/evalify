import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { listCandidateIssuedReports } from "@/lib/reports/service";

export async function GET() {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  return NextResponse.json(
    { reports: await listCandidateIssuedReports(authorization.user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
