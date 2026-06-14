import type { ParseOptions, RawReading } from "./types.js";
import { getNow, readFirstFiniteNumber, warnSkipped } from "./utils.js";

const EVENT_KEYS = ["trg", "eventCount", "event_count", "event", "eventId", "event_id"] as const;
const SIPM_KEYS = ["sipmMv", "sipm_mv", "sipm", "mv", "SiPM", "SIPM"] as const;
const TEMP_KEYS = ["tempC", "temp_c", "temp", "temperature", "TEMP", "T"] as const;
const PRESSURE_KEYS = ["pressurePa", "pressure_pa", "pressure", "pres", "PRES", "P"] as const;
const DEADTIME_KEYS = ["deadtimePercent", "deadtime_percent", "deadtime", "dt", "DT"] as const;
const COINCIDENT_KEYS = ["coincident", "coin", "COIN", "COINCIDENT"] as const;
const TIMESTAMP_KEYS = ["timestamp", "ts", "time", "TIME", "TS"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseJsonLine(line: string, options?: ParseOptions): RawReading | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return warnSkipped(options, "Skipped malformed JSON serial line.", line);
  }

  const record = asRecord(parsed);
  if (record === null) {
    return warnSkipped(options, "Skipped JSON serial line that is not an object.", line);
  }

  const sipmMv = readFirstFiniteNumber(record, SIPM_KEYS);
  if (sipmMv === null) {
    return warnSkipped(options, "Skipped JSON serial line without a numeric SiPM amplitude.", line);
  }

  const timestamp = readFirstFiniteNumber(record, TIMESTAMP_KEYS);
  const eventCount = readFirstFiniteNumber(record, EVENT_KEYS);
  const coincident = readFirstFiniteNumber(record, COINCIDENT_KEYS);
  const tempC = readFirstFiniteNumber(record, TEMP_KEYS);
  const pressurePa = readFirstFiniteNumber(record, PRESSURE_KEYS);
  const deadtimePercent = readFirstFiniteNumber(record, DEADTIME_KEYS);

  const reading: RawReading = {
    timestamp: timestamp ?? getNow(options),
    eventCount: eventCount ?? 1,
    sipmMv,
    coincident: coincident ?? 0,
    sourceFormat: "json",
  };

  if (tempC !== null) {
    reading.tempC = tempC;
  }
  if (pressurePa !== null) {
    reading.pressurePa = pressurePa;
  }
  if (deadtimePercent !== null) {
    reading.deadtimePercent = deadtimePercent;
  }

  return reading;
}
