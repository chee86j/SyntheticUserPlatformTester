import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedUrl, normalizeAllowedDomains, redactEventPayload, redactSensitiveText } from "./security.js";

test("redactEventPayload removes secrets recursively", () => {
  const redacted = redactEventPayload({
    password: "Secret123!",
    nested: {
      authorization: "Bearer abc123xyz",
      note: "cookie=session123 token=abc"
    },
    items: [{ apiKey: "sk-secret-value" }]
  });

  assert.deepEqual(redacted, {
    password: "[redacted]",
    nested: {
      authorization: "[redacted]",
      note: "cookie=[redacted] token=[redacted]"
    },
    items: [{ apiKey: "[redacted]" }]
  });
});

test("redactSensitiveText masks bearer tokens and API keys in free text", () => {
  const value = redactSensitiveText("Authorization: Bearer abc123 and key sk-supersecret");
  assert.equal(value, "Authorization: [redacted] [redacted] and key [redacted]");
});

test("normalizeAllowedDomains canonicalizes hosts", () => {
  assert.deepEqual(normalizeAllowedDomains([" Example.com ", "https://api.example.com/path", "example.com"]), [
    "example.com",
    "api.example.com"
  ]);
});

test("isAllowedUrl permits configured domains and browser-safe schemes only", () => {
  assert.equal(
    isAllowedUrl({
      url: "https://sub.example.com/dashboard",
      allowedDomains: ["example.com"],
      baseUrl: "https://app.example.com"
    }),
    true
  );
  assert.equal(
    isAllowedUrl({
      url: "https://evil.example.net/phish",
      allowedDomains: ["example.com"],
      baseUrl: "https://app.example.com"
    }),
    false
  );
  assert.equal(
    isAllowedUrl({
      url: "data:text/plain,hello",
      allowedDomains: ["example.com"],
      baseUrl: "https://app.example.com"
    }),
    true
  );
});
