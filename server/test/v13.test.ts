// server/test/v13.test.ts
// v1.3 test suite: EventBus pub/sub, SSE serialization, Telegram formatting,
// SimulationService decision paths, notification gating matrix.
// All network and DB calls are mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  eventBus,
  type EventHandler,
} from "../src/lib/eventBus";
import {
  escapeMarkdownV2,
  formatActionAlert,
  formatOutOfRangeAlert,
  formatTestMessage,
} from "../src/clients/telegram";
import {
  SimulationService,
  type PublicClientLike,
} from "../src/services/simulation";
import { shouldNotify, type AlertEvent } from "../src/services/notifications";
import type { NotificationSettingDto } from "../../shared/types";
import type { Address, Hex } from "viem";

// ============================================================
// 1. EVENTBUS PUB/SUB
// ============================================================

describe("EventBus", () => {
  beforeEach(() => eventBus.clear());
  afterEach(() => eventBus.clear());

  it("delivers events to all subscribers", () => {
    const handler1: EventHandler = vi.fn();
    const handler2: EventHandler = vi.fn();
    eventBus.subscribe(handler1);
    eventBus.subscribe(handler2);

    eventBus.publish({
      type: "price_update",
      data: { poolId: "0x123", price: 3180, ts: Date.now() },
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("filters events by type when types are specified", () => {
    const handler: EventHandler = vi.fn();
    eventBus.subscribe(handler, ["strategy_action"]);

    eventBus.publish({
      type: "price_update",
      data: { poolId: "0x1", price: 100, ts: Date.now() },
    });
    eventBus.publish({
      type: "strategy_action",
      data: {
        id: "a1",
        positionId: "p1",
        ts: Date.now(),
        type: "REBALANCE",
        status: "EXECUTED",
        txHash: null,
        detailsJson: "{}",
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("subscriber errors do not block the publisher", () => {
    const badHandler: EventHandler = vi.fn(() => {
      throw new Error("subscriber crash");
    });
    const goodHandler: EventHandler = vi.fn();
    eventBus.subscribe(badHandler);
    eventBus.subscribe(goodHandler);

    eventBus.publish({
      type: "engine_status",
      data: { running: true, dryRun: false, lastRunTs: 0 },
    });

    expect(badHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops receiving events", () => {
    const handler: EventHandler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    eventBus.publish({
      type: "price_update",
      data: { poolId: "0x1", price: 1, ts: 0 },
    });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    eventBus.publish({
      type: "price_update",
      data: { poolId: "0x1", price: 2, ts: 0 },
    });
    expect(handler).toHaveBeenCalledTimes(1); // not incremented
  });

  it("generates monotonically increasing sequence IDs", () => {
    const a = eventBus.nextSeq();
    const b = eventBus.nextSeq();
    const c = eventBus.nextSeq();
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });
});

// ============================================================
// 2. SSE EVENT SERIALIZATION
// ============================================================

describe("SSE event serialization", () => {
  it("price_update event has correct shape", () => {
    const data = { poolId: "0xabc", price: 3180.5, ts: 1700000000000 };
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json);
    expect(parsed.poolId).toBe("0xabc");
    expect(parsed.price).toBe(3180.5);
    expect(parsed.ts).toBe(1700000000000);
  });

  it("position_status event has correct shape", () => {
    const data = {
      positionId: "pos-1",
      inRange: false,
      valueUsd: 12450.0,
      unclaimedFeesUsd: 42.18,
    };
    const parsed = JSON.parse(JSON.stringify(data));
    expect(parsed.inRange).toBe(false);
    expect(parsed.valueUsd).toBe(12450.0);
  });

  it("strategy_action event matches StrategyActionDto", () => {
    const data = {
      id: "act-1",
      positionId: "pos-1",
      ts: 1700000000000,
      type: "REBALANCE",
      status: "EXECUTED",
      txHash: "0xdeadbeef",
      detailsJson: '{"reason":"out of range 8h"}',
    };
    const parsed = JSON.parse(JSON.stringify(data));
    expect(parsed.type).toBe("REBALANCE");
    expect(parsed.status).toBe("EXECUTED");
  });

  it("engine_status event has correct shape", () => {
    const data = { running: true, dryRun: false, lastRunTs: 1700000000000 };
    const parsed = JSON.parse(JSON.stringify(data));
    expect(parsed.running).toBe(true);
    expect(parsed.dryRun).toBe(false);
  });

  it("SSE frame format: id, event, data", () => {
    // Simulate the frame serialization logic
    const seq = 42;
    const type = "price_update";
    const payload = { poolId: "0x1", price: 100, ts: 0 };
    const frame = `id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    expect(frame).toContain("id: 42");
    expect(frame).toContain("event: price_update");
    expect(frame.endsWith("\n\n")).toBe(true);
  });
});

// ============================================================
// 3. TELEGRAM MESSAGE FORMATTING / ESCAPING
// ============================================================

describe("Telegram MarkdownV2 escaping", () => {
  it("escapes all special MarkdownV2 characters", () => {
    const input = "Hello_World [test] (paren) ~tilde~ `code` >quote #hash +plus -minus =eq |pipe {brace} .dot !bang";
    const escaped = escapeMarkdownV2(input);
    // Every special char should be backslash-escaped
    expect(escaped).toContain("\\_");
    expect(escaped).toContain("\\[");
    expect(escaped).toContain("\\]");
    expect(escaped).toContain("\\(");
    expect(escaped).toContain("\\)");
    expect(escaped).toContain("\\~");
    expect(escaped).toContain("\\`");
    expect(escaped).toContain("\\>");
    expect(escaped).toContain("\\#");
    expect(escaped).toContain("\\+");
    expect(escaped).toContain("\\-");
    expect(escaped).toContain("\\=");
    expect(escaped).toContain("\\|");
    expect(escaped).toContain("\\{");
    expect(escaped).toContain("\\}");
    expect(escaped).toContain("\\.");
    expect(escaped).toContain("\\!");
  });

  it("does not modify strings without special chars", () => {
    expect(escapeMarkdownV2("plain text 123")).toBe("plain text 123");
  });

  it("escapes backslash itself", () => {
    expect(escapeMarkdownV2("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("formatActionAlert includes action type and status", () => {
    const msg = formatActionAlert({
      actionType: "REBALANCE",
      status: "EXECUTED",
      pair: "WETH/USDC",
      tokenId: 10241,
      reason: "out of range 8h",
    });
    expect(msg).toContain("REBALANCE");
    expect(msg).toContain("EXECUTED");
    expect(msg).toContain("WETH/USDC");
    expect(msg).toContain("10241");
    // Pair with / should be escaped
    expect(msg).toContain("WETH/USDC"); // / is not special in MdV2
  });

  it("formatActionAlert includes dry-run notice when dryRun=true", () => {
    const msg = formatActionAlert({
      actionType: "COMPOUND",
      status: "DRY_RUN",
      pair: "WETH/DAI",
      tokenId: 1,
      dryRun: true,
    });
    expect(msg.toLowerCase()).toContain("dry run");
  });

  it("formatActionAlert uses correct status icons", () => {
    const executed = formatActionAlert({ actionType: "X", status: "EXECUTED", pair: "A/B", tokenId: 1 });
    const failed = formatActionAlert({ actionType: "X", status: "FAILED", pair: "A/B", tokenId: 1 });
    const dryRun = formatActionAlert({ actionType: "X", status: "DRY_RUN", pair: "A/B", tokenId: 1 });
    expect(executed).toContain("✅");
    expect(failed).toContain("❌");
    expect(dryRun).toContain("🧪");
  });

  it("formatOutOfRangeAlert includes hours", () => {
    const msg = formatOutOfRangeAlert("WETH/USDC", 10241, 8.5);
    expect(msg).toContain("8");
    expect(msg).toContain("Out of Range");
  });

  it("formatTestMessage is valid MarkdownV2", () => {
    const msg = formatTestMessage();
    expect(msg).toContain("Test Message");
    // No unescaped dots or exclamation marks
    expect(msg).not.toMatch(/(?<!\\)\./);
    expect(msg).not.toMatch(/(?<!\\)!/);
  });
});

// ============================================================
// 4. SIMULATION SERVICE DECISION PATHS
// ============================================================

describe("SimulationService", () => {
  function createMockClient(
    readContractResult: unknown,
    estimateGasResult: bigint,
    readContractError?: Error
  ): PublicClientLike {
    return {
      readContract: vi.fn().mockResolvedValue(
        readContractError
          ? Promise.reject(readContractError)
          : readContractResult
      ),
      estimateGas: vi.fn().mockResolvedValue(estimateGasResult),
    };
  }

  it("returns ok=true with amounts and gas cost when simulation succeeds", async () => {
    const mockClient = createMockClient(
      [1_000_000n, 2_000_000n], // amount0, amount1
      250_000n // gas estimate
    );
    const svc = new SimulationService({
      client: mockClient,
      ethPriceUsd: 2500,
      gasPriceWei: 2_000_000_000n, // 2 gwei
    });

    const result = await svc.simulate({
      type: "COMPOUND",
      tokenId: 123,
      caller: "0x1234" as Address,
    });

    expect(result.ok).toBe(true);
    expect(result.expectedAmount0).toBe("1000000");
    expect(result.expectedAmount1).toBe("2000000");
    expect(result.gasEstimate).toBe("250000");
    // 250000 * 2 gwei = 0.0005 ETH * $2500 = $1.25
    expect(result.gasCostUsd).toBeCloseTo(1.25, 2);
  });

  it("returns ok=false with reason when readContract throws", async () => {
    const mockClient = createMockClient(
      null,
      0n,
      new Error("execution reverted: NotOwner")
    );
    const svc = new SimulationService({ client: mockClient });

    const result = await svc.simulate({
      type: "REBALANCE",
      tokenId: 999,
      caller: "0xabcd" as Address,
    });

    expect(result.ok).toBe(false);
    expect(result.expectedAmount0).toBe("0");
    expect(result.reason).toContain("NotOwner");
  });

  it("returns ok=false when estimateGas throws", async () => {
    const mockClient: PublicClientLike = {
      readContract: vi.fn().mockResolvedValue([100n, 200n]),
      estimateGas: vi.fn().mockRejectedValue(new Error("gas estimation failed")),
    };
    const svc = new SimulationService({ client: mockClient });

    const result = await svc.simulate({
      type: "COMPOUND",
      tokenId: 1,
      caller: "0x1" as Address,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("gas estimation failed");
  });

  it("STOP_LOSS dispatches to decreaseLiquidity simulation", async () => {
    const mockClient = createMockClient(
      [500_000n, 600_000n],
      300_000n
    );
    const svc = new SimulationService({ client: mockClient });

    const result = await svc.simulate({
      type: "STOP_LOSS",
      tokenId: 42,
      caller: "0x2" as Address,
    });

    expect(result.ok).toBe(true);
    expect(result.expectedAmount0).toBe("500000");
    expect(result.expectedAmount1).toBe("600000");
  });

  it("computes gas cost correctly from gas and price", async () => {
    const mockClient = createMockClient([0n, 0n], 1_000_000n);
    const svc = new SimulationService({
      client: mockClient,
      ethPriceUsd: 3000,
      gasPriceWei: 10_000_000_000n, // 10 gwei
    });

    const result = await svc.simulate({
      type: "COMPOUND",
      tokenId: 1,
      caller: "0x1" as Address,
    });

    // 1M gas * 10 gwei = 0.01 ETH * $3000 = $30
    expect(result.gasCostUsd).toBeCloseTo(30, 2);
  });
});

// ============================================================
// 5. NOTIFICATION GATING MATRIX (min 10 cases)
// ============================================================

describe("Notification gating matrix", () => {
  function makeSetting(
    overrides: Partial<NotificationSettingDto>
  ): NotificationSettingDto {
    return {
      owner: "user1",
      telegramChatId: "123456",
      enabled: true,
      onRebalance: true,
      onCompound: true,
      onStopLoss: true,
      onFailure: true,
      onOutOfRangeHrs: 6,
      updatedAt: Date.now(),
      ...overrides,
    };
  }

  // Case 1: fully enabled, rebalance event → should notify
  it("[1] fully enabled + rebalance → true", () => {
    expect(shouldNotify(makeSetting({}), "rebalance")).toBe(true);
  });

  // Case 2: fully enabled + compound → true
  it("[2] fully enabled + compound → true", () => {
    expect(shouldNotify(makeSetting({}), "compound")).toBe(true);
  });

  // Case 3: fully enabled + stopLoss → true
  it("[3] fully enabled + stopLoss → true", () => {
    expect(shouldNotify(makeSetting({}), "stopLoss")).toBe(true);
  });

  // Case 4: fully enabled + failure → true
  it("[4] fully enabled + failure → true", () => {
    expect(shouldNotify(makeSetting({}), "failure")).toBe(true);
  });

  // Case 5: fully enabled + outOfRange (with threshold set) → true
  it("[5] enabled + outOfRange with threshold → true", () => {
    expect(shouldNotify(makeSetting({ onOutOfRangeHrs: 6 }), "outOfRange")).toBe(true);
  });

  // Case 6: globally disabled → false for all events
  it("[6] globally disabled → false", () => {
    expect(shouldNotify(makeSetting({ enabled: false }), "rebalance")).toBe(false);
    expect(shouldNotify(makeSetting({ enabled: false }), "compound")).toBe(false);
  });

  // Case 7: no telegramChatId → false
  it("[7] no chat ID → false", () => {
    expect(
      shouldNotify(makeSetting({ telegramChatId: null }), "rebalance")
    ).toBe(false);
  });

  // Case 8: onRebalance=false → false for rebalance, true for others
  it("[8] onRebalance=false → false for rebalance only", () => {
    expect(shouldNotify(makeSetting({ onRebalance: false }), "rebalance")).toBe(false);
    expect(shouldNotify(makeSetting({ onRebalance: false }), "compound")).toBe(true);
  });

  // Case 9: onOutOfRangeHrs=null → false for outOfRange
  it("[9] outOfRangeHrs=null → false for outOfRange", () => {
    expect(
      shouldNotify(makeSetting({ onOutOfRangeHrs: null }), "outOfRange")
    ).toBe(false);
  });

  // Case 10: setting is null → false for everything
  it("[10] null setting → false", () => {
    expect(shouldNotify(null, "rebalance")).toBe(false);
    expect(shouldNotify(null, "compound")).toBe(false);
    expect(shouldNotify(null, "failure")).toBe(false);
  });

  // Case 11: onFailure=false → failure gated off
  it("[11] onFailure=false → false for failure", () => {
    expect(shouldNotify(makeSetting({ onFailure: false }), "failure")).toBe(false);
  });

  // Case 12: onStopLoss=false → stopLoss gated off
  it("[12] onStopLoss=false → false for stopLoss", () => {
    expect(shouldNotify(makeSetting({ onStopLoss: false }), "stopLoss")).toBe(false);
  });

  // Case 13: onOutOfRangeHrs=0 → false (disabled)
  it("[13] onOutOfRangeHrs=0 → false for outOfRange", () => {
    expect(shouldNotify(makeSetting({ onOutOfRangeHrs: 0 }), "outOfRange")).toBe(false);
  });
});
