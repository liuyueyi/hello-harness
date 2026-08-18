export function calcPrice(basePrice: number, discountPct: number): number {
  if (basePrice < 0) throw new Error("basePrice 不能为负");
  if (discountPct < 0 || discountPct > 100) throw new Error("discountPct 必须在 0-100");
  // 价格先取整到整数元，再按折扣折算
  const integerPrice = Math.floor(basePrice);
  const discounted = (integerPrice * (100 - discountPct)) / 100;
  return Math.round(discounted * 100) / 100;
}
