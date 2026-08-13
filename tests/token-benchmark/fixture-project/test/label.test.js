import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLabel } from "../src/label.js";

test("returns the current label unchanged", () => {
  assert.equal(normalizeLabel(" Example "), " Example ");
});
