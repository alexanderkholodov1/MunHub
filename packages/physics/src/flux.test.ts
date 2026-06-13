import { describe, expect, it } from "vitest";
import { rateToFlux } from "./flux.js";

describe("rateToFlux", () => {
  it("flux = rate / area (300/min over 25 cm² → 12 /cm²/min)", () => {
    expect(rateToFlux(300, 25)).toBe(12);
  });

  it("zero rate gives zero flux", () => {
    expect(rateToFlux(0, 25)).toBe(0);
  });

  it("rejects a non-positive area and negative rates", () => {
    expect(() => rateToFlux(300, 0)).toThrow(RangeError);
    expect(() => rateToFlux(-1, 25)).toThrow(RangeError);
  });
});
