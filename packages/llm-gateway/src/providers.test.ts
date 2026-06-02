import assert from "node:assert/strict";
import test from "node:test";
import { OpenAiProvider } from "./openai-provider.js";
import { AnthropicProvider } from "./anthropic-provider.js";

const originalFetch = globalThis.fetch;

test("OpenAI adapter returns normalized completion", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "cmpl_1",
        choices: [{ message: { content: "hello" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  const provider = new OpenAiProvider({
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "sk-test"
  });

  const response = await provider.complete({ prompt: "say hello" });
  assert.equal(response.text, "hello");
  assert.equal(response.inputTokens, 10);
  assert.equal(response.outputTokens, 5);
  assert.equal(response.metadata.provider, "openai");
});

test("Anthropic adapter returns normalized completion", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: "msg_1",
        content: [{ type: "text", text: "hello from claude" }],
        usage: { input_tokens: 12, output_tokens: 8 },
        stop_reason: "end_turn"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  const provider = new AnthropicProvider({
    provider: "anthropic",
    model: "claude-3-5-haiku-latest",
    apiKey: "ak-test"
  });

  const response = await provider.complete({ prompt: "say hello" });
  assert.equal(response.text, "hello from claude");
  assert.equal(response.inputTokens, 12);
  assert.equal(response.outputTokens, 8);
  assert.equal(response.metadata.provider, "anthropic");
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
