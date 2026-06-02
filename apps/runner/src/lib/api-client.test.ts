import assert from "node:assert/strict";
import test from "node:test";
import { RunnerApiClient } from "./api-client.js";

test("RunnerApiClient retries after 401 by re-authenticating", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: { headers?: unknown } }> = [];

  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/auth/login")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "set-cookie": "sup_session=fresh-cookie; Path=/; HttpOnly" }
      });
    }

    const cookie = readCookie(init);
    if (cookie === "sup_session=fresh-cookie") {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;

  try {
    const client = new RunnerApiClient();
    const response = await client.request("/api/events", { method: "POST", body: { ok: true } });
    assert.deepEqual(response, { ok: true });
    assert.equal(calls.filter((call) => String(call.url).endsWith("/auth/login")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function readCookie(init?: { headers?: unknown }): string {
  const headers = init?.headers;
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get("cookie") ?? "";
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === "cookie");
    return match?.[1] ?? "";
  }
  return typeof headers === "object" && "cookie" in headers ? String(headers.cookie ?? "") : "";
}
