import { parseCosmicWatchLine } from "./cosmicwatch.js";
import { parseCsvLine } from "./csv.js";
import { parseJsonLine } from "./json.js";
import { parseKeyValueLine } from "./key-value.js";
import type { ParseOptions, RawReading, SerialFormat, SerialLineParser } from "./types.js";
import { getLogger } from "./utils.js";

export type { ParseOptions, ParserLogger, RawReading, SerialFormat } from "./types.js";
export { parseCosmicWatchLine } from "./cosmicwatch.js";
export { parseCsvLine } from "./csv.js";
export { parseJsonLine } from "./json.js";
export { parseKeyValueLine } from "./key-value.js";

const PARSERS: Record<SerialFormat, SerialLineParser> = {
  json: parseJsonLine,
  cosmicwatch: parseCosmicWatchLine,
  keyValue: parseKeyValueLine,
  csv: parseCsvLine,
};

function isHeaderOrInfoLine(line: string): boolean {
  if (line.length < 5 || !/\d/.test(line)) {
    return true;
  }

  if (line.includes("[") || line.includes("Event") || line.includes("TimeStamp")) {
    return true;
  }

  return /^[A-Za-z]/.test(line) && !/TRG\s+\d/i.test(line);
}

export function detectSerialFormat(line: string): SerialFormat | "unknown" {
  const trimmed = line.trim();
  if (isHeaderOrInfoLine(trimmed)) {
    return "unknown";
  }

  if (trimmed.startsWith("{")) {
    return "json";
  }

  if (/^\d+[\t ]+\d+[\t ]+\d+/.test(trimmed) || trimmed.includes("COSMIC")) {
    return "cosmicwatch";
  }

  if (trimmed.includes("TRG") && /TRG\s+\d/i.test(trimmed)) {
    return "keyValue";
  }

  if (trimmed.includes(",") && /^\d/.test(trimmed)) {
    return "csv";
  }

  if (/^\d+\s+\d+/.test(trimmed)) {
    return "cosmicwatch";
  }

  return "unknown";
}

export function parseSerialLine(line: string, options?: ParseOptions): RawReading | null {
  const trimmed = line.trim();
  const format = detectSerialFormat(trimmed);
  if (format === "unknown") {
    getLogger(options).warn("Skipped unrecognized serial line.", { line });
    return null;
  }

  return PARSERS[format](trimmed, options);
}

export function splitSerialBufferLines(chunk: string): string[] {
  return chunk
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=COSMIC)(?=\d)/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
