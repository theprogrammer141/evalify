import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  enrollCandidate,
  getExaminerExamination,
} from "@/lib/examinations/service";
import { enrollmentSchema } from "@/lib/examinations/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const examination = await getExaminerExamination(
    authorization.user.id,
    id,
  );
  if (!examination) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { candidates: examination.candidates },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const parsed = enrollmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_enrollment", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await enrollCandidate(
    authorization.user.id,
    id,
    parsed.data.candidateId,
  );
  if (
    result.status === "not_found" ||
    result.status === "candidate_not_found"
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "completed") {
    return NextResponse.json(
      { error: "examination_completed" },
      { status: 409 },
    );
  }
  if (result.status === "already_enrolled") {
    return NextResponse.json({ error: "already_enrolled" }, { status: 409 });
  }

  return NextResponse.json({ enrolled: true }, { status: 201 });
}