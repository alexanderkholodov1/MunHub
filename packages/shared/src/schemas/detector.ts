/**
 * Detector — the physical CosmicWatch device inside a station (D21). Data belongs to the detector
 * because calibration is per-device.
 */
import { z } from "zod";
import { IdSchema } from "./primitives.js";
import { HardwareVersionSchema, DetectorStatusSchema } from "./enums.js";

/**
 * Calibration — sensible defaults by hardware, with optional advanced overrides (D23).
 * `adcToMv` is the linear ADC→millivolt mapping `[slope, intercept]`.
 */
export const CalibrationSchema = z
  .object({
    adcToMv: z.tuple([z.number(), z.number()]).optional(),
    saturationMv: z.number().positive().optional(),
    triggerAdcMin: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Calibration = z.infer<typeof CalibrationSchema>;

export const DetectorSchema = z
  .object({
    id: IdSchema,
    stationId: IdSchema,
    label: z.string().optional(),
    /** Auto-generated device identity; enables the "different device" consistency warning. */
    deviceToken: IdSchema,
    hardwareModel: z.string().min(1),
    firmwareVersion: z.string().min(1),
    hwVersion: HardwareVersionSchema,
    sipmCount: z.number().int().positive().default(1),
    calibration: CalibrationSchema.optional(),
    status: DetectorStatusSchema.default("active"),
    addedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

export type Detector = z.infer<typeof DetectorSchema>;
