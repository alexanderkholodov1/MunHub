import { describe, expect, it } from "vitest";
import { InMemoryLocalStore } from "./local-store.js";
import type { EventSummary, MinuteRecord, SignalRecord } from "@munhub/shared";
import type { SignalBlobRef } from "@munhub/data-provider";

function record(ts: number, ec: number): MinuteRecord {
  return {
    ts,
    ec,
    cc: 0,
    sm: 10,
    sx: 10,
    sn: 10,
    tp: 20,
    pr: 1_010,
    dt: 1,
  };
}

function summary(intervalStartTs: number, signalCount: number): EventSummary {
  return {
    detectorId: "detector-a",
    sessionId: "session-a",
    intervalStartTs,
    intervalEndTs: intervalStartTs + 1_000,
    signalCount,
    aboveThresholdCount: signalCount,
    tailCount: 0,
    coincidenceCount: 0,
    noiseThresholdMv: 10,
    histogram: {
      binWidthMv: 1,
      minMv: 0,
      counts: [signalCount],
    },
  };
}

function signal(ts: number, sipmMv = 30): SignalRecord {
  return {
    ts,
    sipmMv,
    coincident: false,
    deadtimeUs: 10,
  };
}

function blobRef(intervalStartTs: number): SignalBlobRef {
  return {
    detectorId: "detector-a",
    sessionId: "session-a",
    intervalStartTs,
  };
}

describe("InMemoryLocalStore", () => {
  it("persists records by detector and timestamp", async () => {
    const store = new InMemoryLocalStore();
    const minute = record(60_000, 2);

    await store.saveMinuteRecord("detector-a", minute);

    await expect(store.getMinuteRecord("detector-a", 60_000)).resolves.toEqual({
      detectorId: "detector-a",
      record: minute,
      synced: false,
    });
  });

  it("deduplicates queued records by detector and timestamp", async () => {
    const store = new InMemoryLocalStore();

    await store.queueMinuteRecord("detector-a", record(60_000, 2));
    await store.queueMinuteRecord("detector-a", record(60_000, 3));

    await expect(store.listQueuedMinuteRecords()).resolves.toEqual([
      { detectorId: "detector-a", record: record(60_000, 3) },
    ]);
  });

  it("lists queued records ordered by timestamp", async () => {
    const store = new InMemoryLocalStore();

    await store.queueMinuteRecord("detector-a", record(120_000, 2));
    await store.queueMinuteRecord("detector-a", record(60_000, 1));

    await expect(store.listQueuedMinuteRecords()).resolves.toEqual([
      { detectorId: "detector-a", record: record(60_000, 1) },
      { detectorId: "detector-a", record: record(120_000, 2) },
    ]);
  });

  it("removes records from the queue after marking them synced", async () => {
    const store = new InMemoryLocalStore();

    await store.queueMinuteRecord("detector-a", record(60_000, 2));
    await store.markMinuteRecordSynced("detector-a", 60_000);

    await expect(store.listQueuedMinuteRecords()).resolves.toEqual([]);
    await expect(store.getMinuteRecord("detector-a", 60_000)).resolves.toMatchObject({
      synced: true,
    });
  });

  it("deduplicates queued event summaries by detector and interval start", async () => {
    const store = new InMemoryLocalStore();

    await store.queueEventSummary(summary(60_000, 2));
    await store.queueEventSummary(summary(60_000, 3));

    await expect(store.listQueuedEventSummaries()).resolves.toEqual([
      { detectorId: "detector-a", summary: summary(60_000, 2) },
    ]);
  });

  it("orders and marks queued event summaries as synced", async () => {
    const store = new InMemoryLocalStore();

    await store.queueEventSummary(summary(120_000, 2));
    await store.queueEventSummary(summary(60_000, 1));
    await store.markEventSummarySynced("detector-a", 60_000);

    await expect(store.listQueuedEventSummaries()).resolves.toEqual([
      { detectorId: "detector-a", summary: summary(120_000, 2) },
    ]);
  });

  it("deduplicates queued signal blobs by SignalBlobRef", async () => {
    const store = new InMemoryLocalStore();

    await store.queueSignalBlob(blobRef(60_000), [signal(60_100, 30)]);
    await store.queueSignalBlob(blobRef(60_000), [signal(60_200, 40)]);

    await expect(store.listQueuedSignalBlobs()).resolves.toEqual([
      { ref: blobRef(60_000), signals: [signal(60_100, 30)] },
    ]);
  });

  it("orders and marks queued signal blobs as synced", async () => {
    const store = new InMemoryLocalStore();

    await store.queueSignalBlob(blobRef(120_000), [signal(120_100)]);
    await store.queueSignalBlob(blobRef(60_000), [signal(60_100)]);
    await store.markSignalBlobSynced(blobRef(60_000));

    await expect(store.listQueuedSignalBlobs()).resolves.toEqual([
      { ref: blobRef(120_000), signals: [signal(120_100)] },
    ]);
  });
});
