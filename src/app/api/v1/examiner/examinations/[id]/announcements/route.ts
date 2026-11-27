import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import {
  createExaminerAnnouncement,
  listExaminerAnnouncements,
} from "@/lib/monitoring/service";
import { announcementInputSchema } from "@/lib/monitoring/validation";

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthorization() {
  const authorization = await authorizeApi();
  if (!authorization.authorized) return authorization;
  if (
    authorization.user.role !== "EXAMINER" &&
    authorization.user.role !== "ADMIN"
  ) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return authorization;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await getAuthorization();
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  const announcements = await listExaminerAnnouncements(id, {
    userId: authorization.user.id,
    isAdmin: authorization.user.role === "ADMIN",
  });
  if (!announcements) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { announcements },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await getAuthorization();
  if (!authorization.authorized) return authorization.response;

  const parsed = announcementInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_announcement", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await createExaminerAnnouncement(
    id,
    {
      userId: authorization.user.id,
      isAdmin: authorization.user.role === "ADMIN",
    },
    parsed.data,
  );
  if (result.status === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (result.status === "unavailable") {
    return NextResponse.json(
      { error: "examination_not_active" },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { announcement: result.announcement },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
