import { calcPrice } from "../../../price.ts";

const cases = [
  { basePrice: 99.9, discountPct: 0, expected: 99.9, note: "无折扣应保留分位" },
  { basePrice: 100, discountPct: 10, expected: 90, note: "10% 折扣" },
  { basePrice: 990, discountPct: 10, expected: 891, note: "990 打 10% 折" },
];

let failed = 0;
for (const c of cases) {
  const actual = calcPrice(c.basePrice, c.discountPct);
  const ok = actual === c.expected;
  console.log(`${ok ? "通过" : "失败"} · calcPrice(${c.basePrice}, ${c.discountPct}) = ${actual}，期望 ${c.expected}（${c.note}）`);
  if (!ok) failed += 1;
}

console.log(`复现结果：${failed === 0 ? "全部通过" : `失败 ${failed} 个用例`}`);
process.exit(failed === 0 ? 0 : 1);
