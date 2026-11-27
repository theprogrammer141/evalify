import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { z } from "zod";

const emailSchema = z.string().email();

async function bootstrapAdmin() {
  loadEnvConfig(process.cwd());
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !emailSchema.safeParse(email).success) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL to a valid email address.");
  }
  if (!password || Buffer.byteLength(password, "utf8") < 12) {
    throw new Error(
      "Set BOOTSTRAP_ADMIN_PASSWORD to a password of at least 12 bytes.",
    );
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD must not exceed bcrypt's 72-byte limit.",
    );
  }

  const { db, sql } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [createdUser] = await db
      .insert(users)
      .values({ email, passwordHash, role: "ADMIN" })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    if (!createdUser) {
      const [existingUser] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser?.role !== "ADMIN") {
        throw new Error(
          "The bootstrap email already belongs to a non-administrator account.",
        );
      }

      console.info("Bootstrap administrator already exists; no changes made.");
    } else {
      console.info("Bootstrap administrator created.");
    }
  } finally {
    await sql.end();
  }
}

bootstrapAdmin()
  .catch((error: unknown) => {
    console.error("Administrator bootstrap failed.", error);
    process.exitCode = 1;
  })
