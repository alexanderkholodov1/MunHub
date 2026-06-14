import type { ParseOptions, RawReading } from "./types.js";
import { getNow, parseFiniteNumberToken, warnSkipped } from "./utils.js";

function requireTokenNumber(tokens: readonly string[], index: number): number | null {
  const token = tokens[index];
  return token === undefined ? null : parseFiniteNumberToken(token);
}

export function parseCosmicWatchLine(line: string, options?: ParseOptions): RawReading | null {
  const tokens = line
    .trim()
    .split(/[\t ]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "" && part.toUpperCase() !== "COSMIC");

  if (tokens.length < 7) {
    return warnSkipped(options, "Skipped CosmicWatch line with insufficient columns.", line);
  }

  const eventId = requireTokenNumber(tokens, 0);
  const detectorTimestampMs = requireTokenNumber(tokens, 1);
  const adc1 = requireTokenNumber(tokens, 2);
  const adc2 = requireTokenNumber(tokens, 3);
  const sipmMv = requireTokenNumber(tokens, 4);
  const pressurePa = requireTokenNumber(tokens, 5);
  const tempC = requireTokenNumber(tokens, 6);
  const deadtimeUs = tokens[7] === undefined ? null : requireTokenNumber(tokens, 7);
  const coincident = tokens[8] === undefined ? 0 : requireTokenNumber(tokens, 8);

  if (
    eventId === null ||
    detectorTimestampMs === null ||
    adc1 === null ||
    adc2 === null ||
    sipmMv === null ||
    pressurePa === null ||
    tempC === null ||
    coincident === null
  ) {
    return warnSkipped(options, "Skipped malformed CosmicWatch line.", line);
  }

  const reading: RawReading = {
    timestamp: getNow(options),
    eventCount: 1,
    sipmMv,
    coincident,
    sourceFormat: "cosmicwatch",
    eventId,
    detectorTimestampMs,
    adc1,
    adc2,
    pressurePa,
    tempC,
  };

  if (deadtimeUs !== null) {
    reading.deadtimePercent = (deadtimeUs / 1_000_000) * 100;
  }

  return reading;
}
