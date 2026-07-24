import { describe, it, expect } from "vitest";
import {
  priceToTick,
  tickToPrice,
  nearestUsableTick,
  sqrtPriceX96ToPrice,
  impermanentLoss,
  concentrationFactor,
  liquidityDistribution,
  feeApr,
  isInRange,
} from "../src/lib/defi-math";

describe("tick <-> price", () => {
  it("priceToTick is inverse-ish of tickToPrice", () => {
    const tick = priceToTick(1500);
    // reconstructed price should be within one tick step of the input
    expect(tickToPrice(tick)).toBeGreaterThan(1490);
    expect(tickToPrice(tick)).toBeLessThan(1510);
  });

  it("tick 0 => price 1", () => {
    expect(tickToPrice(0)).toBeCloseTo(1, 10);
  });

  it("priceToTick(1) => 0", () => {
    expect(priceToTick(1)).toBe(0);
  });
});

describe("nearestUsableTick", () => {
  it("rounds to spacing", () => {
    expect(nearestUsableTick(107, 60)).toBe(120);
    expect(nearestUsableTick(29, 60)).toBe(0);
    expect(nearestUsableTick(-107, 60)).toBe(-120);
  });
});

describe("sqrtPriceX96ToPrice", () => {
  it("sqrtPriceX96 = 2^96 with equal decimals => price 1", () => {
    const Q96 = 2n ** 96n;
    expect(sqrtPriceX96ToPrice(Q96, 18, 18)).toBeCloseTo(1, 6);
  });

  it("applies decimal adjustment", () => {
    const Q96 = 2n ** 96n;
    // decimals0=6, decimals1=18 -> raw * 10^(6-18)
    expect(sqrtPriceX96ToPrice(Q96, 6, 18)).toBeCloseTo(1e-12, 18);
  });
});

describe("impermanentLoss", () => {
  it("no price change => zero IL", () => {
    expect(impermanentLoss(1)).toBeCloseTo(0, 10);
  });

  it("price change produces negative IL (a loss)", () => {
    expect(impermanentLoss(2)).toBeLessThan(0);
    expect(impermanentLoss(0.5)).toBeLessThan(0);
  });

  it("symmetric for reciprocal ratios", () => {
    expect(impermanentLoss(4)).toBeCloseTo(impermanentLoss(0.25), 6);
  });

  it("guards non-positive input", () => {
    expect(impermanentLoss(0)).toBe(0);
    expect(impermanentLoss(-3)).toBe(0);
  });
});

describe("concentrationFactor", () => {
  it("returns >= 1 for a valid tight range", () => {
    expect(concentrationFactor(0.9, 1.1, 1)).toBeGreaterThan(1);
  });

  it("tighter range => higher capital efficiency", () => {
    const tight = concentrationFactor(0.95, 1.05, 1);
    const wide = concentrationFactor(0.5, 2, 1);
    expect(tight).toBeGreaterThan(wide);
  });

  it("invalid range returns 1", () => {
    expect(concentrationFactor(2, 1, 1)).toBe(1);
    expect(concentrationFactor(1, 2, 0)).toBe(1);
  });
});

describe("liquidityDistribution", () => {
  it("returns the requested number of bins", () => {
    expect(liquidityDistribution(1000, 2000, 1500, 20)).toHaveLength(20);
  });

  it("marks in-range bins with higher liquidity than out-of-range", () => {
    const bins = liquidityDistribution(1000, 2000, 1500, 40);
    const inRange = bins.filter((b) => b.price >= 1000 && b.price <= 2000);
    const outRange = bins.filter((b) => b.price < 1000 || b.price > 2000);
    const avgIn = inRange.reduce((s, b) => s + b.liquidity, 0) / inRange.length;
    const avgOut =
      outRange.reduce((s, b) => s + b.liquidity, 0) / outRange.length;
    expect(avgIn).toBeGreaterThan(avgOut);
  });
});

describe("feeApr", () => {
  it("annualizes 24h fees over position value", () => {
    // $10/day on $36500 => 10% APR
    expect(feeApr(10, 36500)).toBeCloseTo(10, 6);
  });

  it("guards zero/negative position value", () => {
    expect(feeApr(10, 0)).toBe(0);
    expect(feeApr(10, -5)).toBe(0);
  });
});

describe("isInRange", () => {
  it("true when current within [lower, upper]", () => {
    expect(isInRange(1500, 1000, 2000)).toBe(true);
    expect(isInRange(1000, 1000, 2000)).toBe(true);
    expect(isInRange(2000, 1000, 2000)).toBe(true);
  });

  it("false when outside", () => {
    expect(isInRange(999, 1000, 2000)).toBe(false);
    expect(isInRange(2001, 1000, 2000)).toBe(false);
  });
});
