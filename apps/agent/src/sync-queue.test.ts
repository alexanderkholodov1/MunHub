import type { EventSummary, MinuteRecord, SignalRecord } from "@munhub/shared";
import type { SignalBlobRef } from "@munhub/data-provider";
import { describe, expect, it } from "vitest";
import { InMemoryLocalStore } from "./local-store.js";
import type { EventScienceUploader } from "./event-science-upload.js";
import { OfflineSyncQueue, type FlushBreakdown, type FlushKindResult, type MinuteRecordUploader } from "./sync-queue.js";

function record(ts: number, ec = 1): MinuteRecord {
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

function summary(intervalStartTs: number): EventSummary {
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

function signal(ts: number): SignalRecord {
  return {
    ts,
    sipmMv: 30,
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

function kind(attempted: number, uploaded: number, remaining: number): FlushKindResult {
  return { attempted, uploaded, remaining };
}

function flushResult(breakdown: FlushBreakdown) {
  return {
    attempted:
      breakdown.minuteRecords.attempted + breakdown.eventSummaries.attempted + breakdown.signalBlobs.attempted,
    uploaded: breakdown.minuteRecords.uploaded + breakdown.eventSummaries.uploaded + breakdown.signalBlobs.uploaded,
    remaining: breakdown.minuteRecords.remaining + breakdown.eventSummaries.remaining + breakdown.signalBlobs.remaining,
    breakdown,
  };
}

class FakeUploader implements MinuteRecordUploader {
  readonly calls: Array<{ detectorId: string; record: MinuteRecord }> = [];
  failOnCall: number | null = null;

  async pushMinuteRecord(detectorId: string, minute: MinuteRecord): Promise<void> {
    const callNumber = this.calls.length + 1;
    if (this.failOnCall === callNumber) {
      this.failOnCall = null;
      throw new Error("network unavailable");
    }

    this.calls.push({ detectorId, record: minute });
  }
}

class FakeEventScienceUploader implements EventScienceUploader {
  readonly summaryCalls: EventSummary[] = [];
  readonly blobCalls: Array<{ ref: SignalBlobRef; signals: SignalRecord[] }> = [];
  failSummaryOnCall: number | null = null;
  failBlobOnCall: number | null = null;

  async pushEventSummary(eventSummary: EventSummary): Promise<void> {
    const callNumber = this.summaryCalls.length + 1;
    if (this.failSummaryOnCall === callNumber) {
      this.failSummaryOnCall = null;
      throw new Error("summary upload unavailable");
    }

    this.summaryCalls.push(eventSummary);
  }

  async pushSignalBlob(ref: SignalBlobRef, signals: SignalRecord[]): Promise<void> {
    const callNumber = this.blobCalls.length + 1;
    if (this.failBlobOnCall === callNumber) {
      this.failBlobOnCall = null;
      throw new Error("blob upload unavailable");
    }

    this.blobCalls.push({ ref, signals });
  }
}

describe("OfflineSyncQueue", () => {
  it("queues records while offline and does not upload", async () => {
    const store = new InMemoryLocalStore();
    const uploader = new FakeUploader();
    const queue = new OfflineSyncQueue({ store, uploader });

    await queue.enqueueMinuteRecord("detector-a", record(60_000));

    await expect(store.listQueuedMinuteRecords()).resolves.toHaveLength(1);
    await expect(queue.flush()).resolves.toEqual(
      flushResult({
        minuteRecords: kind(0, 0, 1),
        eventSummaries: kind(0, 0, 0),
        signalBlobs: kind(0, 0, 0),
      }),
    );
    expect(uploader.calls).toEqual([]);
  });

  it("flushes queued records on reconnect in timestamp order", async () => {
    const store = new InMemoryLocalStore();
    const uploader = new FakeUploader();
    const queue = new OfflineSyncQueue({ store, uploader });

    await queue.enqueueMinuteRecord("detector-a", record(120_000));
    await queue.enqueueMinuteRecord("detector-a", record(60_000));

    await expect(queue.setOnline(true)).resolves.toEqual(
      flushResult({
        minuteRecords: kind(2, 2, 0),
        eventSummaries: kind(0, 0, 0),
        signalBlobs: kind(0, 0, 0),
      }),
    );
    expect(uploader.calls.map((call) => call.record.ts)).toEqual([60_000, 120_000]);
    await expect(store.listQueuedMinuteRecords()).resolves.toEqual([]);
  });

  it("suppresses duplicates by detector and timestamp", async () => {
    const store = new InMemoryLocalStore();
    const uploader = new FakeUploader();
    const queue = new OfflineSyncQueue({ store, uploader });

    await queue.enqueueMinuteRecord("detector-a", record(60_000, 1));
    await queue.enqueueMinuteRecord("detector-a", record(60_000, 2));
    await queue.setOnline(true);
    await queue.enqueueMinuteRecord("detector-a", record(60_000, 3));

    expect(uploader.calls).toHaveLength(1);
    expect(uploader.calls[0]?.record.ec).toBe(2);
  });

  it("resumes after a partial flush without re-uploading synced records", async () => {
    const store = new InMemoryLocalStore();
    const uploader = new FakeUploader();
    const queue = new OfflineSyncQueue({ store, uploader });

    await queue.enqueueMinuteRecord("detector-a", record(60_000));
    await queue.enqueueMinuteRecord("detector-a", record(120_000));
    await queue.enqueueMinuteRecord("detector-a", record(180_000));
    uploader.failOnCall = 2;

    await queue.setOnline(true);
    expect(uploader.calls.map((call) => call.record.ts)).toEqual([60_000]);
    await expect(store.listQueuedMinuteRecords()).resolves.toHaveLength(2);

    await expect(queue.flush()).resolves.toEqual(
      flushResult({
        minuteRecords: kind(2, 2, 0),
        eventSummaries: kind(0, 0, 0),
        signalBlobs: kind(0, 0, 0),
      }),
    );
    expect(uploader.calls.map((call) => call.record.ts)).toEqual([60_000, 120_000, 180_000]);
  });

  it("persists locally before attempting upload", async () => {
    const store = new InMemoryLocalStore();
    const uploader: MinuteRecordUploader = {
      async pushMinuteRecord(detectorId, minute) {
        await expect(store.getMinuteRecord(detectorId, minute.ts)).resolves.toMatchObject({
          detectorId,
          record: minute,
        });
      },
    };
    const queue = new OfflineSyncQueue({ store, uploader });

    await queue.setOnline(true);
    await queue.enqueueMinuteRecord("detector-a", record(60_000));
  });

  it("flushes queued event summaries and signal blobs, then skips them on a second flush", async () => {
    const store = new InMemoryLocalStore();
    const uploader = new FakeUploader();
    const eventScienceUploader = new FakeEventScienceUploader();
    const queue = new OfflineSyncQueue({ store, uploader, eventScienceUploader });

    await store.queueEventSummary(summary(60_000));
    await store.queueEventSummary(summary(120_000));
    await store.queueSignalBlob(blobRef(60_000), [signal(60_100)]);
    await store.queueSignalBlob(blobRef(120_000), [signal(120_100)]);
    await queue.setOnline(true);

    expect(eventScienceUploader.summaryCalls.map((call) => call.intervalStartTs)).toEqual([60_000, 120_000]);
    expect(eventScienceUploader.blobCalls.map((call) => call.ref.intervalStartTs)).toEqual([60_000, 120_000]);
    await expect(queue.flush()).resolves.toEqual(
      flushResult({
        minuteRecords: kind(0, 0, 0),
        eventSummaries: kind(0, 0, 0),
        signalBlobs: kind(0, 0, 0),
      }),
    );
    expect(eventScienceUploader.summaryCalls).toHaveLength(2);
    expect(eventScienceUploader.blobCalls).toHaveLength(2);
  });

  it("stops event-science flushes on the first failure and resumes without duplicates or loss", async () => {
    const store = new InMemoryLocalStore();
    const uploader = new FakeUploader();
    const eventScienceUploader = new FakeEventScienceUploader();
    const queue = new OfflineSyncQueue({ store, uploader, eventScienceUploader });

    await queue.enqueueMinuteRecord("detector-a", record(60_000));
    await store.queueEventSummary(summary(60_000));
    await store.queueEventSummary(summary(120_000));
    await store.queueSignalBlob(blobRef(60_000), [signal(60_100)]);
    eventScienceUploader.failSummaryOnCall = 1;

    await queue.setOnline(true);

    expect(uploader.calls.map((call) => call.record.ts)).toEqual([60_000]);
    expect(eventScienceUploader.summaryCalls).toEqual([]);
    expect(eventScienceUploader.blobCalls).toEqual([]);
    await expect(store.listQueuedEventSummaries()).resolves.toHaveLength(2);
    await expect(store.listQueuedSignalBlobs()).resolves.toHaveLength(1);

    await expect(queue.flush()).resolves.toEqual(
      flushResult({
        minuteRecords: kind(0, 0, 0),
        eventSummaries: kind(2, 2, 0),
        signalBlobs: kind(1, 1, 0),
      }),
    );
    expect(uploader.calls.map((call) => call.record.ts)).toEqual([60_000]);
    expect(eventScienceUploader.summaryCalls.map((call) => call.intervalStartTs)).toEqual([60_000, 120_000]);
    expect(eventScienceUploader.blobCalls.map((call) => call.ref.intervalStartTs)).toEqual([60_000]);
  });
});
