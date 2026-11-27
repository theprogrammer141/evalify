import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  getExaminerExamination,
  updateExamination,
} from "@/lib/examinations/service";
import { examinationUpdateSchema } from "@/lib/examinations/validation";

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
    { examination },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const parsed = examinationUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_examination", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateExamination(
    authorization.user.id,
    id,
    parsed.data,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "completed") {
    return NextResponse.json(
      { error: "examination_completed" },
      { status: 409 },
    );
  }
  if (result.status === "invalid") {
    return NextResponse.json(
      { error: "invalid_examination", issues: result.issues },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { examination: result.examination },
    { headers: { "Cache-Control": "no-store" } },
  );
}