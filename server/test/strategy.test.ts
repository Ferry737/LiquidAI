// server/test/strategy.test.ts
// Strategy decision matrix — in/out of range × elapsed hours × fee thresholds
// × stop-loss. Exercises every branch of the pure decide() function.

import { describe, it, expect } from "vitest";
import {
  decide,
  DEFAULT_CONFIG,
  type DecisionConfig,
  type DecisionPosition,
} from "../../shared/strategy";

function basePos(overrides: Partial<DecisionPosition> = {}): DecisionPosition {
  return {
    positionId: "test-1",
    pair: "WETH/USDC",
    inRange: true,
    outOfRangeHours: 0,
    unclaimedFeesUsd: 0,
    ilPct: 0,
    currentPrice: 3000,
    lowerPrice: 2800,
    upperPrice: 3200,
    ...overrides,
  };
}

const defaultCfg: DecisionConfig = { ...DEFAULT_CONFIG };

describe("strategy decide() — decision matrix", () => {
  // ---- DISABLED ----
  it("returns SKIPPED when strategy is disabled", () => {
    const pos = basePos({ unclaimedFeesUsd: 100 });
    const d = decide(pos, { ...defaultCfg, enabled: false });
    expect(d.type).toBe("SKIPPED");
    expect(d.reason).toContain("disabled");
  });

  it("disabled config skips even when out of range for 10h", () => {
    const pos = basePos({ inRange: false, outOfRangeHours: 10 });
    const d = decide(pos, { ...defaultCfg, enabled: false });
    expect(d.type).toBe("SKIPPED");
  });

  // ---- STOP LOSS ----
  it("triggers STOP_LOSS when IL exceeds threshold", () => {
    const pos = basePos({ ilPct: -15 });
    const d = decide(pos, { ...defaultCfg, stopLossIlPct: 10 });
    expect(d.type).toBe("STOP_LOSS");
    expect(d.reason).toContain("IL");
  });

  it("does not trigger STOP_LOSS when IL is below threshold", () => {
    const pos = basePos({ ilPct: -5 });
    const d = decide(pos, { ...defaultCfg, stopLossIlPct: 10 });
    expect(d.type).not.toBe("STOP_LOSS");
  });

  it("stop-loss null means no stop-loss check", () => {
    const pos = basePos({ ilPct: -99 });
    const d = decide(pos, { ...defaultCfg, stopLossIlPct: null });
    expect(d.type).not.toBe("STOP_LOSS");
  });

  it("stop-loss exactly at threshold triggers", () => {
    const pos = basePos({ ilPct: -10 });
    const d = decide(pos, { ...defaultCfg, stopLossIlPct: 10 });
    expect(d.type).toBe("STOP_LOSS");
  });

  // ---- REBALANCE ----
  it("REBALANCE when out of range >= threshold hours", () => {
    const pos = basePos({
      inRange: false,
      outOfRangeHours: 7,
      currentPrice: 3300,
      lowerPrice: 3200,
      upperPrice: 3400,
    });
    const d = decide(pos, { ...defaultCfg, rebalanceAfterHrs: 6 });
    expect(d.type).toBe("REBALANCE");
    expect(d.newLower).toBeDefined();
    expect(d.newUpper).toBeDefined();
  });

  it("no REBALANCE when out of range but below threshold hours", () => {
    const pos = basePos({ inRange: false, outOfRangeHours: 3 });
    const d = decide(pos, { ...defaultCfg, rebalanceAfterHrs: 6 });
    expect(d.type).not.toBe("REBALANCE");
  });

  it("no REBALANCE when in range", () => {
    const pos = basePos({ inRange: true, outOfRangeHours: 0 });
    const d = decide(pos, defaultCfg);
    expect(d.type).not.toBe("REBALANCE");
  });

  it("REBALANCE fires at exactly the threshold (>= comparison)", () => {
    const pos = basePos({
      inRange: false,
      outOfRangeHours: 6,
      currentPrice: 3300,
      lowerPrice: 3200,
      upperPrice: 3400,
    });
    const d = decide(pos, { ...defaultCfg, rebalanceAfterHrs: 6 });
    expect(d.type).toBe("REBALANCE");
  });

  it("REBALANCE new range is centered on current price", () => {
    const pos = basePos({
      inRange: false,
      outOfRangeHours: 8,
      currentPrice: 3500,
      lowerPrice: 3000,
      upperPrice: 4000,
    });
    const d = decide(pos, defaultCfg);
    expect(d.type).toBe("REBALANCE");
    // Width = (4000 - 3000) / 2 = 500
    expect(d.newLower).toBeCloseTo(3000, 0);
    expect(d.newUpper).toBeCloseTo(4000, 0);
  });

  // ---- COMPOUND ----
  it("COMPOUND when fees >= threshold", () => {
    const pos = basePos({ unclaimedFeesUsd: 15 });
    const d = decide(pos, { ...defaultCfg, compoundMinUsd: 10 });
    expect(d.type).toBe("COMPOUND");
    expect(d.amountUsd).toBe(15);
  });

  it("no COMPOUND when fees below threshold", () => {
    const pos = basePos({ unclaimedFeesUsd: 5 });
    const d = decide(pos, { ...defaultCfg, compoundMinUsd: 10 });
    expect(d.type).not.toBe("COMPOUND");
  });

  it("COMPOUND fires at exactly the threshold (>= comparison)", () => {
    const pos = basePos({ unclaimedFeesUsd: 10 });
    const d = decide(pos, { ...defaultCfg, compoundMinUsd: 10 });
    expect(d.type).toBe("COMPOUND");
  });

  // ---- SKIPPED (within bounds) ----
  it("returns SKIPPED when in range and fees below threshold", () => {
    const pos = basePos({ inRange: true, unclaimedFeesUsd: 2 });
    const d = decide(pos, defaultCfg);
    expect(d.type).toBe("SKIPPED");
    expect(d.reason).toContain("within bounds");
  });

  // ---- PRIORITY ORDERING ----
  it("STOP_LOSS has priority over REBALANCE", () => {
    const pos = basePos({
      inRange: false,
      outOfRangeHours: 10,
      ilPct: -20,
    });
    const d = decide(pos, { ...defaultCfg, stopLossIlPct: 10 });
    expect(d.type).toBe("STOP_LOSS");
  });

  it("REBALANCE has priority over COMPOUND", () => {
    const pos = basePos({
      inRange: false,
      outOfRangeHours: 10,
      unclaimedFeesUsd: 100,
    });
    const d = decide(pos, defaultCfg);
    expect(d.type).toBe("REBALANCE");
  });

  // ---- EDGE: zero thresholds ----
  it("rebalanceAfterHrs=0 triggers REBALANCE immediately when out of range", () => {
    const pos = basePos({
      inRange: false,
      outOfRangeHours: 0.01,
      currentPrice: 3300,
      lowerPrice: 3200,
      upperPrice: 3400,
    });
    const d = decide(pos, { ...defaultCfg, rebalanceAfterHrs: 0 });
    expect(d.type).toBe("REBALANCE");
  });

  it("compoundMinUsd=0 triggers COMPOUND for any non-negative fees", () => {
    const pos = basePos({ unclaimedFeesUsd: 0 });
    const d = decide(pos, { ...defaultCfg, compoundMinUsd: 0 });
    expect(d.type).toBe("COMPOUND");
  });
});
