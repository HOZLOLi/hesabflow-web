import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Coerce any value to a safe finite number for Decimal math.
 * Forms emit '' / undefined / NaN while the user is typing — old raw JS math
 * tolerated those via coercion (`'' * 1 === 0`), but Decimal throws. Normalize
 * here so every money helper is safe to call mid-edit.
 */
const num = (v: unknown): number => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// --- Primitives ---

export function moneyAdd(a: number, b: number): number {
  return new Decimal(num(a)).plus(num(b)).toNumber();
}

export function moneySub(a: number, b: number): number {
  return new Decimal(num(a)).minus(num(b)).toNumber();
}

export function moneyMul(a: number, b: number): number {
  return new Decimal(num(a)).times(num(b)).toNumber();
}

export function moneyDiv(a: number, b: number): number {
  const denom = num(b);
  if (denom === 0) return 0;
  return new Decimal(num(a)).dividedBy(denom).toNumber();
}

/** base × (percent / 100) */
export function moneyPercent(base: number, percent: number): number {
  return new Decimal(num(base)).times(new Decimal(num(percent)).dividedBy(100)).toNumber();
}

export function moneyRound(value: number): number {
  return new Decimal(num(value)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Safe sum of an array — use instead of arr.reduce((a,b) => a + b, 0) */
export function moneySum(values: number[]): number {
  return values.reduce((acc, v) => new Decimal(acc).plus(num(v)).toNumber(), 0);
}

// --- Invoice helpers ---

/**
 * Per-row total: (qty × unitPrice) − discount + tax
 * Use this everywhere an InvoiceItem.total needs to be (re)calculated.
 */
export function calcItemTotal(
  quantity: number,
  unitPrice: number,
  discount: number,
  tax: number,
): number {
  return new Decimal(num(quantity))
    .times(num(unitPrice))
    .minus(num(discount))
    .plus(num(tax))
    .toNumber();
}

/**
 * Per-row profit: (sellPrice − buyPrice) × qty
 */
export function calcItemProfit(
  unitPrice: number,
  buyPriceSnapshot: number,
  quantity: number,
): number {
  return new Decimal(num(unitPrice)).minus(num(buyPriceSnapshot)).times(num(quantity)).toNumber();
}

/**
 * Sell price after applying a pricing strategy on a new buy price.
 * strategy.type = 'percent'  →  newBuy + newBuy × (value / 100)
 * strategy.type = 'fixed'    →  newBuy + value
 */
export function calcSellPriceFromStrategy(
  newBuyPrice: number,
  strategy: { type: 'percent' | 'fixed'; value: number },
): number {
  if (strategy.type === 'percent') {
    return moneyRound(moneyAdd(newBuyPrice, moneyPercent(newBuyPrice, strategy.value)));
  }
  return moneyRound(moneyAdd(newBuyPrice, strategy.value));
}
