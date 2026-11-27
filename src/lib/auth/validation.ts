import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "EXAMINER", "CANDIDATE"]);

export const signInSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
});

export const createAccountSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(1024),
  role: roleSchema,
});

export const updateRoleSchema = z.object({
  role: roleSchema,
});

export function isValidBcryptPassword(password: string): boolean {
  return Buffer.byteLength(password, "utf8") <= 72;
}
