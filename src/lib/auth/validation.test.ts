import assert from "node:assert/strict";
import test from "node:test";
import { isValidBcryptPassword } from "@/lib/auth/validation";

test("bcrypt password validation enforces its UTF-8 byte limit", () => {
  assert.equal(isValidBcryptPassword("a".repeat(72)), true);
  assert.equal(isValidBcryptPassword("€".repeat(24)), true);
  assert.equal(isValidBcryptPassword(`${"€".repeat(24)}a`), false);
});
