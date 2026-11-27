import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  revokeSession,
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  await revokeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  await revokeSession(cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value);
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);

  return new NextResponse(null, { status: 204 });
}
