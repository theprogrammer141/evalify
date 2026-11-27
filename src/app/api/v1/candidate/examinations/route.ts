import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { listCandidateExaminations } from "@/lib/examinations/service";

export async function GET() {
  const authorization = await authorizeApi("CANDIDATE");
  if (!authorization.authorized) return authorization.response;

  return NextResponse.json(
    {
      examinations: await listCandidateExaminations(authorization.user.id),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}