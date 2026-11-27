import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth/session";
import { findAccountForSignIn } from "@/lib/auth/accounts";
import { roleHome } from "@/lib/auth/authorization";
import { isValidBcryptPassword, signInSchema } from "@/lib/auth/validation";

export async function POST(request: Request) {
  const parsed = signInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidBcryptPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 },
    );
  }

  const account = await findAccountForSignIn(parsed.data.email);
  if (!account || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) {
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  await revokeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const token = await createSession(account.id);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return NextResponse.json({
    user: {
      id: account.id,
      email: account.email,
      role: account.role,
    },
    redirectTo: roleHome(account.role),
  });
}
