import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/authorization";
import { createAccount, listAccounts } from "@/lib/auth/accounts";
import {
  createAccountSchema,
  isValidBcryptPassword,
} from "@/lib/auth/validation";

export async function GET() {
  const authorization = await authorizeApi("ADMIN");
  if (!authorization.authorized) return authorization.response;

  return NextResponse.json(
    { users: await listAccounts() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeApi("ADMIN");
  if (!authorization.authorized) return authorization.response;

  const parsed = createAccountSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || !isValidBcryptPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "invalid_account", message: "Check the account details and password length." },
      { status: 400 },
    );
  }

  try {
    const user = await createAccount({
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
    });
    return NextResponse.json(
      { user },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "email_in_use" },
        { status: 409 },
      );
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
