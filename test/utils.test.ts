import { describe, it, expect } from "vitest";
import { formatUSD, formatNum, formatPct, shortAddr, cn } from "../src/lib/utils";

describe("formatUSD", () => {
  it("formats standard values under 1000", () => {
    expect(formatUSD(12.5)).toBe("$12.50");
  });

  it("uses compact notation for large values by default", () => {
    expect(formatUSD(1500)).toMatch(/\$1\.50K/);
  });

  it("can disable compact notation", () => {
    expect(formatUSD(1500, false)).toBe("$1,500.00");
  });

  it("guards non-finite input", () => {
    expect(formatUSD(Infinity)).toBe("$0");
    expect(formatUSD(NaN)).toBe("$0");
  });
});

describe("formatNum", () => {
  it("formats with default 2 digits", () => {
    expect(formatNum(1234.567)).toBe("1,234.57");
  });

  it("guards non-finite input", () => {
    expect(formatNum(Infinity)).toBe("0");
  });
});

describe("formatPct", () => {
  it("appends a percent sign with fixed digits", () => {
    expect(formatPct(12.345)).toBe("12.35%");
    expect(formatPct(-3.1)).toBe("-3.10%");
  });

  it("guards non-finite input", () => {
    expect(formatPct(NaN)).toBe("0%");
  });
});

describe("shortAddr", () => {
  it("truncates a full address", () => {
    expect(shortAddr("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234…5678"
    );
  });

  it("returns empty string for undefined", () => {
    expect(shortAddr()).toBe("");
  });
});

describe("cn", () => {
  it("merges class names and dedupes tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false, "font-bold")).toBe("text-sm font-bold");
  });
});
