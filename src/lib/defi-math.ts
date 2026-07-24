// src/lib/defi-math.ts
// Pure helpers: tick <-> price, liquidity distribution, IL, fee APR, PnL.

const Q96 = 2 ** 96;

export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

export function nearestUsableTick(tick: number, spacing: number): number {
  const rounded = Math.round(tick / spacing) * spacing;
  return rounded;
}

export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number {
  const sp = Number(sqrtPriceX96) / Q96;
  const raw = sp * sp;
  return raw * 10 ** (decimals0 - decimals1);
}

// Impermanent loss for a price ratio change r = P_new / P_old, full-range.
export function impermanentLoss(priceRatio: number): number {
  if (priceRatio <= 0) return 0;
  const il = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
  return il * 100; // percent, negative = loss
}

// Concentrated-liquidity capital efficiency multiplier vs full range.
export function concentrationFactor(
  lower: number,
  upper: number,
  current: number
): number {
  if (lower >= upper || current <= 0) return 1;
  const denom = 1 - Math.sqrt(lower / upper);
  return denom > 0 ? 1 / denom : 1;
}

// Synthetic liquidity distribution across a range for the range chart.
export function liquidityDistribution(
  lower: number,
  upper: number,
  current: number,
  bins = 40
): { price: number; liquidity: number; active: boolean }[] {
  const span = upper - lower;
  const pad = span * 0.35;
  const start = lower - pad;
  const end = upper + pad;
  const step = (end - start) / bins;
  const center = (lower + upper) / 2;
  const width = span / 2 || 1;
  return Array.from({ length: bins }, (_, i) => {
    const price = start + step * i;
    const inRange = price >= lower && price <= upper;
    const bell = Math.exp(-Math.pow((price - center) / width, 2) * 1.5);
    return {
      price,
      liquidity: inRange ? bell * 100 : bell * 22,
      active: Math.abs(price - current) < step,
    };
  });
}

export function feeApr(
  fees24hUSD: number,
  positionValueUSD: number
): number {
  if (positionValueUSD <= 0) return 0;
  return ((fees24hUSD * 365) / positionValueUSD) * 100;
}

export function isInRange(
  current: number,
  lower: number,
  upper: number
): boolean {
  return current >= lower && current <= upper;
}
