// test/guards.test.ts
// Tests for /shared runtime type guards.

import { describe, it, expect } from "vitest";
import {
  isStrategyActionType,
  isStrategyActionStatus,
  isStrategyConfigDto,
  isStrategyActionDto,
  isPositionSnapshotDto,
} from "../shared/guards";

describe("isStrategyActionType", () => {
  it("accepts all valid action types", () => {
    expect(isStrategyActionType("REBALANCE")).toBe(true);
    expect(isStrategyActionType("COMPOUND")).toBe(true);
    expect(isStrategyActionType("STOP_LOSS")).toBe(true);
    expect(isStrategyActionType("SKIPPED")).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isStrategyActionType("INVALID")).toBe(false);
    expect(isStrategyActionType("rebalance")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isStrategyActionType(42)).toBe(false);
    expect(isStrategyActionType(null)).toBe(false);
    expect(isStrategyActionType(undefined)).toBe(false);
  });
});

describe("isStrategyActionStatus", () => {
  it("accepts all valid statuses", () => {
    expect(isStrategyActionStatus("EXECUTED")).toBe(true);
    expect(isStrategyActionStatus("FAILED")).toBe(true);
    expect(isStrategyActionStatus("DRY_RUN")).toBe(true);
  });

  it("rejects invalid", () => {
    expect(isStrategyActionStatus("PENDING")).toBe(false);
    expect(isStrategyActionStatus(123)).toBe(false);
  });
});

describe("isStrategyConfigDto", () => {
  const valid = {
    positionId: "abc123",
    enabled: true,
    rebalanceAfterHrs: 6,
    compoundMinUsd: 10,
    maxSlippagePct: 0.5,
    stopLossIlPct: null,
    updatedAt: Date.now(),
  };

  it("accepts a valid config with null stopLoss", () => {
    expect(isStrategyConfigDto(valid)).toBe(true);
  });

  it("accepts a valid config with numeric stopLoss", () => {
    expect(isStrategyConfigDto({ ...valid, stopLossIlPct: 15 })).toBe(true);
  });

  it("rejects missing positionId", () => {
    const { positionId, ...rest } = valid;
    expect(isStrategyConfigDto(rest)).toBe(false);
  });

  it("rejects non-boolean enabled", () => {
    expect(isStrategyConfigDto({ ...valid, enabled: "yes" })).toBe(false);
  });

  it("rejects non-number rebalanceAfterHrs", () => {
    expect(isStrategyConfigDto({ ...valid, rebalanceAfterHrs: "6" })).toBe(
      false
    );
  });

  it("rejects null object", () => {
    expect(isStrategyConfigDto(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isStrategyConfigDto(undefined)).toBe(false);
  });
});

describe("isStrategyActionDto", () => {
  const valid = {
    id: "act-1",
    positionId: "pos-1",
    ts: Date.now(),
    type: "REBALANCE" as const,
    status: "EXECUTED" as const,
    txHash: "0xabc",
    detailsJson: '{"reason":"test"}',
  };

  it("accepts a valid action with txHash", () => {
    expect(isStrategyActionDto(valid)).toBe(true);
  });

  it("accepts a valid action with null txHash", () => {
    expect(isStrategyActionDto({ ...valid, txHash: null })).toBe(true);
  });

  it("rejects invalid action type", () => {
    expect(isStrategyActionDto({ ...valid, type: "INVALID" })).toBe(false);
  });

  it("rejects invalid status", () => {
    expect(isStrategyActionDto({ ...valid, status: "PENDING" })).toBe(false);
  });

  it("rejects missing detailsJson", () => {
    const { detailsJson, ...rest } = valid;
    expect(isStrategyActionDto(rest)).toBe(false);
  });
});

describe("isPositionSnapshotDto", () => {
  const valid = {
    id: "snap-1",
    positionId: "pos-1",
    ts: Date.now(),
    liquidity: "123456",
    amount0: "1.5",
    amount1: "3000",
    unclaimedFeesUsd: 12.5,
    valueUsd: 5000,
    inRange: true,
    ilPct: -0.5,
  };

  it("accepts a valid snapshot", () => {
    expect(isPositionSnapshotDto(valid)).toBe(true);
  });

  it("accepts inRange=false", () => {
    expect(isPositionSnapshotDto({ ...valid, inRange: false })).toBe(true);
  });

  it("rejects non-string liquidity", () => {
    expect(isPositionSnapshotDto({ ...valid, liquidity: 123 })).toBe(false);
  });

  it("rejects non-boolean inRange", () => {
    expect(isPositionSnapshotDto({ ...valid, inRange: "yes" })).toBe(false);
  });

  it("rejects missing positionId", () => {
    const { positionId, ...rest } = valid;
    expect(isPositionSnapshotDto(rest)).toBe(false);
  });
});
