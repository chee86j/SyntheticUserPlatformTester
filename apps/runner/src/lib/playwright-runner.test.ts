import assert from "node:assert/strict";
import test from "node:test";
import { splitSelectorList } from "./playwright-runner.js";

test("splitSelectorList preserves attribute selectors while splitting comma-separated fallbacks", () => {
  const selectors = splitSelectorList('input[name="username"], input[type="email"], #username');

  assert.deepEqual(selectors, ['input[name="username"]', 'input[type="email"]', "#username"]);
});

test("splitSelectorList ignores empty selector entries", () => {
  const selectors = splitSelectorList('button[type="submit"], , input[type="submit"]');

  assert.deepEqual(selectors, ['button[type="submit"]', 'input[type="submit"]']);
});
