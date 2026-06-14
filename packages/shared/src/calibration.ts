import type { Calibration, HardwareVersion } from "./schemas/index.js";

const CALIBRATION_DEFAULTS = {
  v2: {
    adcToMv: [4.8876, 0],
    saturationMv: 5000,
    triggerAdcMin: 50,
  },
  v3X: {
    adcToMv: [0.8059, 0],
    saturationMv: 3300,
    triggerAdcMin: 120,
  },
  unknown: {
    adcToMv: [1, 0],
    saturationMv: 3300,
    triggerAdcMin: 0,
  },
} as const satisfies Record<HardwareVersion, Calibration>;

/**
 * Return a fresh calibration object with conservative defaults for the detector hardware.
 *
 * v2 boards use the classic 10-bit / 5 V ADC scale; v3X boards use a 12-bit / 3.3 V scale.
 * Unknown hardware stays deliberately neutral until the physical board is confirmed.
 */
export function defaultCalibration(hwVersion: HardwareVersion): Calibration {
  const defaults = CALIBRATION_DEFAULTS[hwVersion];
  return {
    adcToMv: [...defaults.adcToMv],
    saturationMv: defaults.saturationMv,
    triggerAdcMin: defaults.triggerAdcMin,
  };
}
