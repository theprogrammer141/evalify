import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import type { AuthenticatedUser } from "@/lib/auth/session";

export async function listAccounts() {
  return db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt, users.email);
}

export async function createAccount(input: {
  email: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [account] = await db
    .insert(users)
    .values({
      email: input.email.trim().toLowerCase(),
      passwordHash,
      role: input.role,
    })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    });

  return account;
}

export async function updateAccountRole(
  accountId: string,
  role: UserRole,
  actingUser: AuthenticatedUser,
) {
  if (accountId === actingUser.id && role !== "ADMIN") {
    return { status: "self_demotion" as const };
  }

  return db.transaction(async (transaction) => {
    const [target] = await transaction
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, accountId))
      .limit(1);

    if (!target) return { status: "not_found" as const };

    if (target.role === "ADMIN" && role !== "ADMIN") {
      const administrators = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "ADMIN"))
        .for("update");

      if (administrators.length <= 1) {
        return { status: "last_admin" as const };
      }
    }

    const [account] = await transaction
      .update(users)
      .set({ role })
      .where(and(eq(users.id, accountId), eq(users.role, target.role)))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!account) {
      return { status: "conflict" as const };
    }

    return { status: "updated" as const, account };
  });
}

export async function findAccountForSignIn(email: string) {
  const [account] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  return account ?? null;
}

