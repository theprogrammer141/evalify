import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { updateAccountRole } from "@/lib/auth/accounts";
import { updateRoleSchema } from "@/lib/auth/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApi("ADMIN");
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parsed = updateRoleSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const result = await updateAccountRole(
    id,
    parsed.data.role,
    authorization.user,
  );

  switch (result.status) {
    case "updated":
      return NextResponse.json(
        { user: result.account },
        { headers: { "Cache-Control": "no-store" } },
      );
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "conflict":
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    case "last_admin":
      return NextResponse.json(
        { error: "last_admin" },
        { status: 409 },
      );
    case "self_demotion":
      return NextResponse.json(
        { error: "self_demotion" },
        { status: 409 },
      );
  }
}
