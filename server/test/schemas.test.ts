// server/test/schemas.test.ts
// Tests for zod validation schemas used in API routes.

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror the route schemas to test them in isolation (they're defined inline
// in the route files, so we replicate the exact validation logic here).
const UpdateBodySchema = z.object({
  enabled: z.boolean().optional(),
  rebalanceAfterHrs: z.number().min(0).max(168).optional(),
  compoundMinUsd: z.number().min(0).max(10000).optional(),
  maxSlippagePct: z.number().min(0).max(10).optional(),
  stopLossIlPct: z.number().min(0).max(100).nullable().optional(),
});

const ActionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const ListQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(100).default(25),
});

const AddressSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid EVM address"),
});

describe("UpdateBodySchema (PUT /strategy)", () => {
  it("accepts a valid partial update", () => {
    const r = UpdateBodySchema.safeParse({
      enabled: false,
      rebalanceAfterHrs: 12,
    });
    expect(r.success).toBe(true);
  });

  it("accepts stopLossIlPct as null", () => {
    const r = UpdateBodySchema.safeParse({ stopLossIlPct: null });
    expect(r.success).toBe(true);
  });

  it("accepts stopLossIlPct as a number", () => {
    const r = UpdateBodySchema.safeParse({ stopLossIlPct: 15 });
    expect(r.success).toBe(true);
  });

  it("rejects stopLossIlPct > 100", () => {
    const r = UpdateBodySchema.safeParse({ stopLossIlPct: 101 });
    expect(r.success).toBe(false);
  });

  it("rejects negative rebalanceAfterHrs", () => {
    const r = UpdateBodySchema.safeParse({ rebalanceAfterHrs: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects rebalanceAfterHrs > 168 (1 week)", () => {
    const r = UpdateBodySchema.safeParse({ rebalanceAfterHrs: 200 });
    expect(r.success).toBe(false);
  });

  it("rejects maxSlippagePct > 10", () => {
    const r = UpdateBodySchema.safeParse({ maxSlippagePct: 11 });
    expect(r.success).toBe(false);
  });

  it("accepts empty object (all fields optional)", () => {
    const r = UpdateBodySchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejects wrong types", () => {
    expect(UpdateBodySchema.safeParse({ enabled: "yes" }).success).toBe(false);
    expect(UpdateBodySchema.safeParse({ compoundMinUsd: "ten" }).success).toBe(
      false
    );
  });
});

describe("ActionQuerySchema (GET /actions)", () => {
  it("applies defaults when no query provided", () => {
    const r = ActionQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });

  it("coerces string page numbers", () => {
    const r = ActionQuerySchema.parse({ page: "3", pageSize: "50" });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(50);
  });

  it("rejects page=0", () => {
    expect(ActionQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it("rejects pageSize > 100", () => {
    expect(ActionQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe("ListQuerySchema (GET /pools)", () => {
  it("defaults to 25", () => {
    expect(ListQuerySchema.parse({}).first).toBe(25);
  });

  it("coerces string", () => {
    expect(ListQuerySchema.parse({ first: "10" }).first).toBe(10);
  });

  it("rejects > 100", () => {
    expect(ListQuerySchema.safeParse({ first: 101 }).success).toBe(false);
  });
});

describe("AddressSchema", () => {
  it("accepts valid lowercase address", () => {
    expect(
      AddressSchema.safeParse({
        address: "0x" + "a".repeat(40),
      }).success
    ).toBe(true);
  });

  it("accepts valid mixed-case address", () => {
    expect(
      AddressSchema.safeParse({
        address: "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01",
      }).success
    ).toBe(true);
  });

  it("rejects too short", () => {
    expect(
      AddressSchema.safeParse({ address: "0x123" }).success
    ).toBe(false);
  });

  it("rejects non-hex chars", () => {
    expect(
      AddressSchema.safeParse({
        address: "0x" + "z".repeat(40),
      }).success
    ).toBe(false);
  });
});
