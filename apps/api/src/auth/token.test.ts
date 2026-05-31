import assert from "node:assert/strict";
import test from "node:test";
import { signSessionToken, verifySessionToken } from "./token.js";

test("signSessionToken and verifySessionToken round-trip claims", () => {
  const token = signSessionToken({
    sub: "user_1",
    orgId: "org_1",
    role: "ADMIN"
  });

  const claims = verifySessionToken(token);

  assert.equal(claims.sub, "user_1");
  assert.equal(claims.orgId, "org_1");
  assert.equal(claims.role, "ADMIN");
});
