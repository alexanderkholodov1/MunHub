import { StorageTierConfigSchema, type EventSummary, type SignalRecord, type StorageTierConfig } from "@munhub/shared";
import type { SignalBlobRef } from "@munhub/data-provider";
import { describe, expect, it } from "vitest";
import { DataProviderEventScienceUploader, routePipelineOutput } from "./event-science-upload.js";
import type { EventSciencePipelineOutput } from "./event-science-pipeline.js";
import { InMemoryLocalStore } from "./local-store.js";
import type { RawReading } from "./parsers/index.js";

const BASE_TS = 1_717_200_000_000;

function storageTier(overrides: Partial<StorageTierConfig> = {}): StorageTierConfig {
  return StorageTierConfigSchema.parse({
    minuteSummaries: true,
    individualSignals: true,
    realtimeMode: "cloud-volatile",
    completeRaw: {
      enabled: false,
      autoStopMinutes: null,
    },
    eventSummaryIntervalMs: 1_000,
    ...overrides,
  });
}

function eventSummary(intervalStartTs: number): EventSummary {
  return {
    detectorId: "detector-a",
    sessionId: "session-a",
    intervalStartTs,
    intervalEndTs: intervalStartTs + 1_000,
    signalCount: 2,
    aboveThresholdCount: 1,
    tailCount: 0,
    coincidenceCount: 0,
    noiseThresholdMv: 10,
    histogram: {
      binWidthMv: 1,
      minMv: 0,
      counts: [1],
    },
  };
}

function signal(offsetMs: number, sipmMv = 30): SignalRecord {
  return {
    ts: BASE_TS + offsetMs,
    sipmMv,
    coincident: false,
    deadtimeUs: 10,
  };
}

function rawReading(offsetMs: number, sipmMv = 5): RawReading {
  return {
    timestamp: BASE_TS + offsetMs,
    eventCount: 1,
    sipmMv,
    coincident: 0,
    sourceFormat: "json",
    tempC: 20,
    pressurePa: 73_000,
    deadtimePercent: 0.04,
  };
}

function output(overrides: Partial<EventSciencePipelineOutput> = {}): EventSciencePipelineOutput {
  return {
    noiseCalibrations: [],
    signalRecords: [],
    eventSummaries: [],
    completeRawReadings: [],
    completeRawStopped: false,
    ...overrides,
  };
}

describe("routePipelineOutput", () => {
  it("enqueues summaries and exactly one signal blob per interval for cloud-volatile individual signals", async () => {
    const store = new InMemoryLocalStore();
    const routed = output({
      eventSummaries: [eventSummary(BASE_TS), eventSummary(BASE_TS + 1_000)],
      signalRecords: [signal(100), signal(200), signal(1_100)],
    });

    await routePipelineOutput(routed, {
      store,
      detectorId: "detector-a",
      sessionId: "session-a",
      storageTier: storageTier(),
    });

    await expect(store.listQueuedEventSummaries()).resolves.toHaveLength(2);
    await expect(store.listQueuedSignalBlobs()).resolves.toEqual([
      {
        ref: {
          detectorId: "detector-a",
          sessionId: "session-a",
          intervalStartTs: BASE_TS,
        },
        signals: [signal(100), signal(200)],
      },
      {
        ref: {
          detectorId: "detector-a",
          sessionId: "session-a",
          intervalStartTs: BASE_TS + 1_000,
        },
        signals: [signal(1_100)],
      },
    ]);
  });

  it("enqueues complete-raw SignalRecord blobs by interval when complete raw cloud upload is enabled", async () => {
    const store = new InMemoryLocalStore();

    await routePipelineOutput(
      output({
        completeRawReadings: [rawReading(100, 5), rawReading(1_100, 6)],
      }),
      {
        store,
        detectorId: "detector-a",
        sessionId: "session-a",
        storageTier: storageTier({
          individualSignals: false,
          completeRaw: {
            enabled: true,
            autoStopMinutes: 10,
          },
        }),
      },
    );

    const blobs = await store.listQueuedSignalBlobs();
    expect(blobs.map((blob) => blob.ref.intervalStartTs)).toEqual([BASE_TS, BASE_TS + 1_000]);
    expect(blobs[0]?.signals[0]).toMatchObject({
      ts: BASE_TS + 100,
      sipmMv: 5,
      coincident: false,
      pressureHpa: 730,
    });
  });

  it("keeps summaries but enqueues no blobs for local-only or none realtime tiers", async () => {
    for (const realtimeMode of ["local-only", "none"] as const) {
      const store = new InMemoryLocalStore();

      await routePipelineOutput(
        output({
          eventSummaries: [eventSummary(BASE_TS)],
          signalRecords: [signal(100)],
          completeRawReadings: [rawReading(100)],
        }),
        {
          store,
          detectorId: "detector-a",
          sessionId: "session-a",
          storageTier: storageTier({
            realtimeMode,
            completeRaw: {
              enabled: true,
              autoStopMinutes: 10,
            },
          }),
        },
      );

      await expect(store.listQueuedEventSummaries()).resolves.toHaveLength(1);
      await expect(store.listQueuedSignalBlobs()).resolves.toEqual([]);
    }
  });

  it("deduplicates repeated routing by provider keys", async () => {
    const store = new InMemoryLocalStore();
    const routed = output({
      eventSummaries: [eventSummary(BASE_TS)],
      signalRecords: [signal(100)],
    });
    const context = {
      store,
      detectorId: "detector-a",
      sessionId: "session-a",
      storageTier: storageTier(),
    };

    await routePipelineOutput(routed, context);
    await routePipelineOutput(routed, context);

    await expect(store.listQueuedEventSummaries()).resolves.toHaveLength(1);
    await expect(store.listQueuedSignalBlobs()).resolves.toHaveLength(1);
  });
});

describe("DataProviderEventScienceUploader", () => {
  it("binds the event-science port to DataProvider event methods only", async () => {
    const calls: Array<{ kind: "summary"; summary: EventSummary } | { kind: "blob"; ref: SignalBlobRef; signals: SignalRecord[] }> =
      [];
    const uploader = new DataProviderEventScienceUploader({
      async putEventSummary(summary) {
        calls.push({ kind: "summary", summary });
      },
      async putSignalBlob(ref, signals) {
        calls.push({ kind: "blob", ref, signals });
      },
    });

    await uploader.pushEventSummary(eventSummary(BASE_TS));
    await uploader.pushSignalBlob(
      {
        detectorId: "detector-a",
        sessionId: "session-a",
        intervalStartTs: BASE_TS,
      },
      [signal(100)],
    );

    expect(calls).toEqual([
      { kind: "summary", summary: eventSummary(BASE_TS) },
      {
        kind: "blob",
        ref: {
          detectorId: "detector-a",
          sessionId: "session-a",
          intervalStartTs: BASE_TS,
        },
        signals: [signal(100)],
      },
    ]);
  });
});
