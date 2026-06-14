export type SerialFormat = "json" | "cosmicwatch" | "keyValue" | "csv";

export interface ParserLogger {
  warn(message: string, context?: unknown): void;
}

export const consoleParserLogger: ParserLogger = {
  warn(message, context) {
    if (context === undefined) {
      console.warn(message);
      return;
    }

    console.warn(message, context);
  },
};

export interface RawReading {
  /** Agent-side event timestamp in epoch milliseconds. */
  timestamp: number;
  /** Per-reading trigger/rate value. Aggregation stores the minute average, never a sum. */
  eventCount: number;
  /** SiPM pulse amplitude in mV. */
  sipmMv: number;
  /** Coincidence flag/value as received from the detector. */
  coincident: number;
  sourceFormat: SerialFormat;
  eventId?: number;
  detectorTimestampMs?: number;
  adc1?: number;
  adc2?: number;
  tempC?: number;
  pressurePa?: number;
  deadtimePercent?: number;
}

export interface ParseOptions {
  now?: () => number;
  logger?: ParserLogger;
}

export type SerialLineParser = (line: string, options?: ParseOptions) => RawReading | null;
