import assert from "node:assert/strict";
import test from "node:test";
import { RunCreateRateLimiter } from "./run-create-rate-limiter.js";

test("RunCreateRateLimiter blocks requests over the configured window", () => {
  const limiter = new RunCreateRateLimiter(2, 60_000);
  assert.deepEqual(limiter.check("org:user", 1_000), { allowed: true });
  assert.deepEqual(limiter.check("org:user", 2_000), { allowed: true });

  const blocked = limiter.check("org:user", 3_000);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.retryAfterSeconds > 0, true);
  }
});

test("RunCreateRateLimiter resets after the window elapses", () => {
  const limiter = new RunCreateRateLimiter(1, 10_000);
  assert.deepEqual(limiter.check("org:user", 1_000), { allowed: true });
  assert.equal(limiter.check("org:user", 2_000).allowed, false);
  assert.deepEqual(limiter.check("org:user", 12_100), { allowed: true });
});
