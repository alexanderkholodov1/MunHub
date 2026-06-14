import { describe, expect, it } from "vitest";
import { CalibrationSchema, defaultCalibration } from "./index.js";

describe("defaultCalibration", () => {
  it("returns v2 ADC defaults for classic 10-bit boards", () => {
    expect(defaultCalibration("v2")).toEqual({
      adcToMv: [4.8876, 0],
      saturationMv: 5000,
      triggerAdcMin: 50,
    });
  });

  it("returns v3X ADC defaults for 12-bit boards", () => {
    expect(defaultCalibration("v3X")).toEqual({
      adcToMv: [0.8059, 0],
      saturationMv: 3300,
      triggerAdcMin: 120,
    });
  });

  it("returns neutral defaults for unconfirmed hardware", () => {
    expect(defaultCalibration("unknown")).toEqual({
      adcToMv: [1, 0],
      saturationMv: 3300,
      triggerAdcMin: 0,
    });
  });

  it("returns a fresh object validated by CalibrationSchema", () => {
    const first = defaultCalibration("v3X");
    const second = defaultCalibration("v3X");

    expect(CalibrationSchema.safeParse(first).success).toBe(true);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.adcToMv).not.toBe(second.adcToMv);
  });
});
