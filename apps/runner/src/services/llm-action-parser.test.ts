import assert from "node:assert/strict";
import test from "node:test";
import { LlmActionParser } from "./llm-action-parser.js";

test("LlmActionParser accepts strict valid JSON", () => {
  const parser = new LlmActionParser();
  const parsed = parser.parse({
    parsedJson: {
      action: "click",
      target: "Invite User",
      reason: "Matches workflow goal",
      confidence: 0.72,
      frustrationDelta: 5
    }
  });

  assert.equal(parsed.action, "click");
});

test("LlmActionParser rejects non-allowed actions", () => {
  const parser = new LlmActionParser();
  assert.throws(() =>
    parser.parse({
      parsedJson: {
        action: "shell",
        target: "rm -rf",
        reason: "bad",
        confidence: 1,
        frustrationDelta: 0
      }
    })
  );
});

test("LlmActionParser rejects malformed JSON text", () => {
  const parser = new LlmActionParser();
  assert.throws(() => parser.parse({ text: "not json" }));
});
