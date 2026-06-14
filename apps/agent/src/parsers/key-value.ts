import type { ParseOptions, RawReading } from "./types.js";
import { getNow, parseFiniteNumberToken, warnSkipped } from "./utils.js";

export function parseKeyValueLine(line: string, options?: ParseOptions): RawReading | null {
  const tokens = line
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");

  if (tokens.length < 2 || tokens.length % 2 !== 0) {
    return warnSkipped(options, "Skipped malformed key-value serial line.", line);
  }

  let timestamp: number | null = null;
  let eventCount: number | null = null;
  let sipmMv: number | null = null;
  let tempC: number | null = null;
  let pressurePa: number | null = null;
  let deadtimePercent: number | null = null;
  let coincident: number | null = null;

  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const rawValue = tokens[index + 1];
    if (key === undefined || rawValue === undefined) {
      return warnSkipped(options, "Skipped partial key-value serial line.", line);
    }

    const value = parseFiniteNumberToken(rawValue);
    if (value === null) {
      return warnSkipped(options, "Skipped key-value serial line with a non-numeric value.", line);
    }

    switch (key.toUpperCase()) {
      case "TRG":
        eventCount = value;
        break;
      case "ADC":
        sipmMv = value * 0.5;
        break;
      case "SIPM":
      case "MV":
        sipmMv = value;
        break;
      case "TEMP":
      case "T":
        tempC = value;
        break;
      case "PRES":
      case "P":
        pressurePa = value;
        break;
      case "DT":
      case "DEADTIME":
        deadtimePercent = value;
        break;
      case "COIN":
      case "COINCIDENT":
        coincident = value;
        break;
      case "TIME":
      case "TS":
        timestamp = value;
        break;
      default:
        break;
    }
  }

  if (sipmMv === null) {
    return warnSkipped(options, "Skipped key-value serial line without a SiPM amplitude.", line);
  }

  const reading: RawReading = {
    timestamp: timestamp ?? getNow(options),
    eventCount: eventCount ?? 1,
    sipmMv,
    coincident: coincident ?? 0,
    sourceFormat: "keyValue",
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
