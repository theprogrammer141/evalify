import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/session";
import type { UserRole } from "@/lib/db/schema";

export type ApiAuthorization =
  | { authorized: true; user: AuthenticatedUser }
  | { authorized: false; response: NextResponse };

export async function authorizeApi(
  requiredRole?: UserRole,
): Promise<ApiAuthorization> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      ),
    };
  }

  if (requiredRole && user.role !== requiredRole) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { authorized: true, user };
}

export async function requirePageUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requirePageRole(
  requiredRole: UserRole,
): Promise<AuthenticatedUser> {
  const user = await requirePageUser();
  if (user.role !== requiredRole) notFound();
  return user;
}

export function roleHome(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "EXAMINER":
      return "/examiner";
    case "CANDIDATE":
      return "/candidate";
  }
}
