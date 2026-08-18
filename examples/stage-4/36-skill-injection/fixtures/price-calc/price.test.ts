import { test } from "node:test";
import assert from "node:assert/strict";
import { calcPrice } from "./price";

test("无折扣时按原价返回（保留分位）", () => {
  assert.equal(calcPrice(99.9, 0), 99.9);
});

test("10% 折扣", () => {
  assert.equal(calcPrice(100, 10), 90);
});

test("990 打 10% 折", () => {
  assert.equal(calcPrice(990, 10), 891);
});

test("参数校验：负价抛错", () => {
  assert.throws(() => calcPrice(-1, 10));
});

test("参数校验：折扣超范围抛错", () => {
  assert.throws(() => calcPrice(100, 101));
});
