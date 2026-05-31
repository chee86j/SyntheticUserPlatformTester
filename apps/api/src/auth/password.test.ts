import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("hashPassword and verifyPassword work for valid credentials", async () => {
  const plainTextPassword = "TestPass123!";
  const hash = await hashPassword(plainTextPassword);

  assert.notEqual(hash, plainTextPassword);
  assert.equal(await verifyPassword(plainTextPassword, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});
