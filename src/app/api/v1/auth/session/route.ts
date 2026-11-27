import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";

export async function GET() {
  const authorization = await authorizeApi();
  if (!authorization.authorized) return authorization.response;

  const { id, email, role, createdAt } = authorization.user;
  return NextResponse.json(
    { user: { id, email, role, createdAt } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
