import { test } from "node:test";
import assert from "node:assert/strict";
import { add, factorial } from "../src/calc.mjs";

test("add(2, 3) === 5", () => {
  assert.equal(add(2, 3), 5);
});

test("factorial(5) === 120", () => {
  assert.equal(factorial(5), 120);
});

test("factorial(0) === 1", () => {
  assert.equal(factorial(0), 1);
});