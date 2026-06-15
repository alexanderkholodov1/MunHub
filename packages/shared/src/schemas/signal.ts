import { z } from "zod";
import { EpochMsSchema } from "./primitives.js";

const NonNegative = z.number().nonnegative();
const NonNegativeInteger = z.number().int().nonnegative();

export const SignalRecordSchema = z
  .object({
    ts: EpochMsSchema,
    sipmMv: NonNegative,
    adc1: NonNegativeInteger.optional(),
    adc2: NonNegativeInteger.optional(),
    coincident: z.boolean(),
    deadtimeUs: NonNegative,
    tempC: z.number().optional(),
    pressureHpa: NonNegative.optional(),
  })
  .strict();

export type SignalRecord = z.infer<typeof SignalRecordSchema>;
