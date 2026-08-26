import assert from "node:assert/strict";
import test from "node:test";

import { extractResultText } from "./extract-result.mjs";

test("extracts result from a single-object run", () => {
  assert.equal(extractResultText(JSON.stringify({ result: "final text" })), "final text");
});

test("extracts result from a stream-array run's result event", () => {
  const stream = JSON.stringify([
    { type: "system", subtype: "init" },
    { type: "assistant", message: { content: [{ type: "text", text: "thinking" }] } },
    { type: "result", subtype: "success", result: "the final answer" },
  ]);
  assert.equal(extractResultText(stream), "the final answer");
});

test("falls back to concatenated assistant text when no result event exists", () => {
  const stream = JSON.stringify([
    { type: "assistant", message: { content: [{ type: "text", text: "part one" }] } },
    { type: "assistant", message: { content: [{ type: "text", text: "part two" }] } },
  ]);
  assert.equal(extractResultText(stream), "part one\npart two");
});

test("non-JSON input passes through raw (a plain transcript)", () => {
  assert.equal(extractResultText("just some text"), "just some text");
});
