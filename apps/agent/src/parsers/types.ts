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
  /** Per-reading event contribution; aggregation stores ec as count per minute. */
  eventCount: number;
  /** SiPM pulse amplitude in mV. */
  sipmMv: number;
  /** Per-reading coincidence contribution; aggregation stores cc as count per minute. */
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
