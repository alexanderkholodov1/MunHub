import { describe, expect, it } from "vitest";
import {
  correctDeadTime,
  correctDeadTimeForHardware,
  correctDeadTimeFromPercent,
  deadTimeLossFraction,
} from "./deadTime.js";

// Reference values: THEORETICAL-FOUNDATION.md §4 (v2 τ ≈ 50 ms, v3X τ ≈ 400 µs).
describe("deadTimeLossFraction", () => {
  it("computes R·τ on a common time base (30/min × 50 ms → 0.025)", () => {
    expect(deadTimeLossFraction(30, 0.05)).toBeCloseTo(0.025, 12);
  });

  it("is zero for a zero rate or zero τ", () => {
    expect(deadTimeLossFraction(0, 0.05)).toBe(0);
    expect(deadTimeLossFraction(30, 0)).toBe(0);
  });

  it("rejects negative or non-finite inputs", () => {
    expect(() => deadTimeLossFraction(-1, 0.05)).toThrow(RangeError);
    expect(() => deadTimeLossFraction(30, Number.NaN)).toThrow(RangeError);
  });
});

describe("correctDeadTime", () => {
  it("matches the v2 reference: 30/min, τ = 50 ms → 30.769…/min", () => {
    expect(correctDeadTime(30, 0.05)).toBeCloseTo(30 / 0.975, 10);
  });

  it("is the identity when τ = 0", () => {
    expect(correctDeadTime(42, 0)).toBe(42);
  });

  it("always increases a positive measured rate", () => {
    expect(correctDeadTime(100, 0.0004)).toBeGreaterThan(100);
  });

  it("throws on saturation (R·τ ≥ 1) instead of clamping", () => {
    // 1200/min × 50 ms → loss fraction exactly 1.
    expect(() => correctDeadTime(1200, 0.05)).toThrow(RangeError);
    expect(() => correctDeadTime(2000, 0.05)).toThrow(/saturated/);
  });
});

describe("correctDeadTimeForHardware", () => {
  it("applies the v2 constant (50 ms)", () => {
    expect(correctDeadTimeForHardware(30, "v2")).toBeCloseTo(30 / 0.975, 10);
  });

  it("v3X correction at 30/min is below 0.05% (τ = 400 µs)", () => {
    const corrected = correctDeadTimeForHardware(30, "v3X");
    expect(corrected / 30 - 1).toBeGreaterThan(0);
    expect(corrected / 30 - 1).toBeLessThan(5e-4);
  });

  it("unknown hardware falls back to the conservative v2 value", () => {
    expect(correctDeadTimeForHardware(30, "unknown")).toBeCloseTo(
      correctDeadTimeForHardware(30, "v2"),
      12,
    );
  });
});

describe("correctDeadTimeFromPercent", () => {
  it("R_real = R / (1 − dt/100): 10% dead time on 27/min → 30/min", () => {
    expect(correctDeadTimeFromPercent(27, 10)).toBeCloseTo(30, 12);
  });

  it("is the identity at 0% and throws at ≥ 100%", () => {
    expect(correctDeadTimeFromPercent(30, 0)).toBe(30);
    expect(() => correctDeadTimeFromPercent(30, 100)).toThrow(RangeError);
    expect(() => correctDeadTimeFromPercent(30, -1)).toThrow(RangeError);
  });
});
