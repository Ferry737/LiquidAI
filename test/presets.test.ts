// test/presets.test.ts
// v1.4: strategy preset schema validation — presets are shared contract data,
// so we lock their shape and values with zod.

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { PRESETS, PRESET_MAP, getPreset } from "../shared/presets";

const PresetSchema = z.object({
  name: z.enum(["conservative", "balanced", "aggressive"]),
  label: z.string().min(1),
  description: z.string().min(1),
  rangeWidthPct: z.number().positive().max(100),
  config: z.object({
    rebalanceAfterHrs: z.number().min(0).max(168),
    compoundMinUsd: z.number().min(0),
    maxSlippagePct: z.number().min(0).max(10),
    stopLossIlPct: z.number().min(0).max(100).nullable(),
  }),
});

describe("strategy presets", () => {
  it("all presets validate against the schema", () => {
    for (const preset of PRESETS) {
      expect(() => PresetSchema.parse(preset)).not.toThrow();
    }
  });

  it("there are exactly three presets in display order", () => {
    expect(PRESETS.map((p) => p.name)).toEqual([
      "conservative",
      "balanced",
      "aggressive",
    ]);
  });

  it("Conservative matches the v1.4 spec", () => {
    const p = PRESET_MAP.conservative;
    expect(p.rangeWidthPct).toBe(30);
    expect(p.config).toEqual({
      rebalanceAfterHrs: 24,
      compoundMinUsd: 25,
      maxSlippagePct: 0.3,
      stopLossIlPct: 5,
    });
  });

  it("Balanced matches the v1.4 spec", () => {
    const p = PRESET_MAP.balanced;
    expect(p.rangeWidthPct).toBe(15);
    expect(p.config).toEqual({
      rebalanceAfterHrs: 6,
      compoundMinUsd: 10,
      maxSlippagePct: 0.5,
      stopLossIlPct: 10,
    });
  });

  it("Aggressive matches the v1.4 spec (no stop-loss)", () => {
    const p = PRESET_MAP.aggressive;
    expect(p.rangeWidthPct).toBe(6);
    expect(p.config).toEqual({
      rebalanceAfterHrs: 2,
      compoundMinUsd: 5,
      maxSlippagePct: 1.0,
      stopLossIlPct: null,
    });
  });

  it("getPreset returns the preset by name and throws on unknown names", () => {
    expect(getPreset("balanced").label).toBe("Balanced");
    // @ts-expect-error — deliberately invalid name
    expect(() => getPreset("degen")).toThrow(/unknown preset/);
  });

  it("presets get strictly narrower & more active from conservative to aggressive", () => {
    const [c, b, a] = PRESETS;
    expect(c.rangeWidthPct).toBeGreaterThan(b.rangeWidthPct);
    expect(b.rangeWidthPct).toBeGreaterThan(a.rangeWidthPct);
    expect(c.config.rebalanceAfterHrs).toBeGreaterThan(b.config.rebalanceAfterHrs);
    expect(b.config.rebalanceAfterHrs).toBeGreaterThan(a.config.rebalanceAfterHrs);
  });
});
