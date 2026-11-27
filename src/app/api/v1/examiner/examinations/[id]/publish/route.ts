import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { publishExamination } from "@/lib/examinations/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeApi("EXAMINER");
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const result = await publishExamination(authorization.user.id, id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "invalid") {
    return NextResponse.json(
      { error: "publication_incomplete", issues: result.issues },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { examination: result.examination },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}