import { MinuteRecordSchema } from "@munhub/shared";
import { describe, expect, it } from "vitest";
import { aggregateMinuteReadings } from "./aggregate.js";
import type { RawReading } from "./parsers/index.js";

const MINUTE_START = 1_717_200_000_000;

function reading(overrides: Partial<RawReading>): RawReading {
  return {
    timestamp: MINUTE_START,
    eventCount: 1,
    sipmMv: 10,
    tempC: 20,
    pressurePa: 101_000,
    deadtimePercent: 1,
    coincident: 0,
    sourceFormat: "json",
    ...overrides,
  };
}

function readingWithoutTemp(overrides: Partial<RawReading>): RawReading {
  const base = reading(overrides);
  const { tempC: _tempC, ...withoutTemp } = base;
  void _tempC;
  return withoutTemp;
}

describe("aggregateMinuteReadings", () => {
  it("produces a schema-valid MinuteRecord with averaged values", () => {
    const record = aggregateMinuteReadings(
      [
        reading({ timestamp: MINUTE_START + 1_000, eventCount: 2, sipmMv: 10, coincident: 0 }),
        reading({
          timestamp: MINUTE_START + 20_000,
          eventCount: 4,
          sipmMv: 20,
          tempC: 24,
          pressurePa: 102_000,
          deadtimePercent: 3,
          coincident: 1,
        }),
      ],
      { minuteStartTs: MINUTE_START },
    );

    expect(MinuteRecordSchema.parse(record)).toEqual(record);
    expect(record).toEqual({
      ts: MINUTE_START,
      ec: 3,
      cc: 0.5,
      sm: 15,
      sx: 20,
      sn: 10,
      tp: 22,
      pr: 1_015,
      dt: 2,
    });
  });

  it("does not double the stored rate when the same readings are duplicated", () => {
    const baseReadings = [
      reading({ timestamp: MINUTE_START + 1_000, eventCount: 3, sipmMv: 11 }),
      reading({ timestamp: MINUTE_START + 2_000, eventCount: 5, sipmMv: 13 }),
    ];

    const original = aggregateMinuteReadings(baseReadings, { minuteStartTs: MINUTE_START });
    const duplicated = aggregateMinuteReadings([...baseReadings, ...baseReadings], {
      minuteStartTs: MINUTE_START,
    });

    expect(original.ec).toBe(4);
    expect(duplicated.ec).toBe(4);
    expect(duplicated.ec).not.toBe(original.ec * 2);
  });

  it("keeps partial field completeness rate-correct while averaging available environment fields", () => {
    const record = aggregateMinuteReadings(
      [
        readingWithoutTemp({ timestamp: MINUTE_START + 1_000, eventCount: 6 }),
        reading({ timestamp: MINUTE_START + 2_000, eventCount: 6, tempC: 30 }),
      ],
      { minuteStartTs: MINUTE_START },
    );

    expect(record.ec).toBe(6);
    expect(record.tp).toBe(30);
  });

  it("rejects readings outside the minute window instead of silently filtering them", () => {
    expect(() =>
      aggregateMinuteReadings(
        [
          reading({ timestamp: MINUTE_START + 1_000 }),
          reading({ timestamp: MINUTE_START + 60_000 }),
        ],
        { minuteStartTs: MINUTE_START },
      ),
    ).toThrow("outside the requested minute window");
  });
});
