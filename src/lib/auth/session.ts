import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessions, users, type UserRole } from "@/lib/db/schema";

export const SESSION_COOKIE_NAME = "evalify_session";
export const LEGACY_SESSION_COOKIE_NAME = "sems_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14;

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_SECONDS * 1000,
  );

  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt,
  });

  return token;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;

  await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return user ?? null;
}
