import { describe, expect, it } from "vitest";
import {
  countsZScore,
  poissonRelativeError,
  poissonSigma,
  robustBaseline,
  sigmaBand,
} from "./statistics.js";

// Reference values: THEORETICAL-FOUNDATION.md §10 — N ≈ 3600/min → σ ≈ 60 → ~1.6% error.
describe("poissonSigma / poissonRelativeError", () => {
  it("σ(3600) = 60 and relative error ≈ 1.67%", () => {
    expect(poissonSigma(3600)).toBe(60);
    expect(poissonRelativeError(3600)).toBeCloseTo(1 / 60, 12);
    expect(poissonRelativeError(3600)).toBeCloseTo(0.0167, 3);
  });

  it("hour-scale integration brings the error below 0.3% (N ≥ 100k)", () => {
    expect(poissonRelativeError(120_000)).toBeLessThan(0.003);
  });

  it("σ(0) = 0; relative error undefined at 0; negatives rejected", () => {
    expect(poissonSigma(0)).toBe(0);
    expect(() => poissonRelativeError(0)).toThrow(RangeError);
    expect(() => poissonSigma(-5)).toThrow(RangeError);
  });
});

describe("sigmaBand", () => {
  it("3σ band around N = 3600 is [3420, 3780]", () => {
    expect(sigmaBand(3600)).toEqual({ lower: 3420, upper: 3780 });
  });

  it("clamps the lower bound at zero for small expectations", () => {
    expect(sigmaBand(4, 3).lower).toBe(0);
  });

  it("rejects k ≤ 0", () => {
    expect(() => sigmaBand(100, 0)).toThrow(RangeError);
  });
});

describe("countsZScore", () => {
  it("an excess of exactly 3σ scores z = 3", () => {
    expect(countsZScore(3780, 3600)).toBeCloseTo(3, 12);
  });

  it("a deficit scores negative (Forbush-like decrease)", () => {
    expect(countsZScore(3540, 3600)).toBeCloseTo(-1, 12);
  });

  it("is undefined for a zero expectation", () => {
    expect(() => countsZScore(10, 0)).toThrow(RangeError);
  });
});

describe("robustBaseline", () => {
  it("reproduces median/IQR and Tukey bounds on a known sample", () => {
    const b = robustBaseline([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(b.median).toBe(5);
    expect(b.q25).toBe(3);
    expect(b.q75).toBe(7);
    expect(b.iqr).toBe(4);
    expect(b.lower).toBe(-1);
    expect(b.upper).toBe(11);
    expect(b.n).toBe(9);
  });

  it("is robust to outliers (median unchanged by one spike)", () => {
    const quiet = robustBaseline([10, 10, 11, 9, 10, 10, 11, 9, 10]);
    const spiked = robustBaseline([10, 10, 11, 9, 10, 10, 11, 9, 1000]);
    expect(spiked.median).toBeCloseTo(quiet.median, 6);
  });

  it("ignores non-finite values and rejects an empty sample", () => {
    expect(robustBaseline([Number.NaN, 5, Number.POSITIVE_INFINITY]).median).toBe(5);
    expect(() => robustBaseline([])).toThrow(RangeError);
  });
});
