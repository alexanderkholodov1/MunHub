import type { MinuteRecord } from "@munhub/shared";
import type { EventScienceUploader } from "./event-science-upload.js";
import type { LocalStore } from "./local-store.js";

export interface MinuteRecordUploader {
  pushMinuteRecord(detectorId: string, record: MinuteRecord): Promise<void>;
}

export interface OfflineSyncQueueOptions {
  store: LocalStore;
  uploader: MinuteRecordUploader;
  eventScienceUploader?: EventScienceUploader;
}

export interface FlushKindResult {
  attempted: number;
  uploaded: number;
  remaining: number;
}

export interface FlushBreakdown {
  minuteRecords: FlushKindResult;
  eventSummaries: FlushKindResult;
  signalBlobs: FlushKindResult;
}

export interface FlushResult extends FlushKindResult {
  breakdown: FlushBreakdown;
}

export class OfflineSyncQueue {
  private readonly store: LocalStore;
  private readonly uploader: MinuteRecordUploader;
  private readonly eventScienceUploader: EventScienceUploader | null;
  private online = false;
  private flushing: Promise<FlushResult> | null = null;

  constructor(options: OfflineSyncQueueOptions) {
    this.store = options.store;
    this.uploader = options.uploader;
    this.eventScienceUploader = options.eventScienceUploader ?? null;
  }

  isOnline(): boolean {
    return this.online;
  }

  async setOnline(online: boolean): Promise<FlushResult | null> {
    this.online = online;
    if (!online) {
      return null;
    }

    return this.flush();
  }

  async enqueueMinuteRecord(detectorId: string, record: MinuteRecord): Promise<FlushResult | null> {
    await this.store.saveMinuteRecord(detectorId, record);
    await this.store.queueMinuteRecord(detectorId, record);

    if (!this.online) {
      return null;
    }

    return this.flush();
  }

  async flush(): Promise<FlushResult> {
    if (!this.online) {
      return this.offlineResult();
    }

    if (this.flushing !== null) {
      return this.flushing;
    }

    this.flushing = this.flushInternal();
    try {
      return await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  private async flushInternal(): Promise<FlushResult> {
    const breakdown = emptyBreakdown();
    let stopped = false;

    const pending = await this.store.listQueuedMinuteRecords();
    for (const entry of pending) {
      breakdown.minuteRecords.attempted += 1;
      try {
        await this.uploader.pushMinuteRecord(entry.detectorId, entry.record);
        await this.store.markMinuteRecordSynced(entry.detectorId, entry.record.ts);
        breakdown.minuteRecords.uploaded += 1;
      } catch {
        stopped = true;
        break;
      }
    }

    if (!stopped && this.eventScienceUploader !== null) {
      const summaries = await this.store.listQueuedEventSummaries();
      for (const entry of summaries) {
        breakdown.eventSummaries.attempted += 1;
        try {
          await this.eventScienceUploader.pushEventSummary(entry.summary);
          await this.store.markEventSummarySynced(entry.detectorId, entry.summary.intervalStartTs);
          breakdown.eventSummaries.uploaded += 1;
        } catch {
          stopped = true;
          break;
        }
      }
    }

    if (!stopped && this.eventScienceUploader !== null) {
      const blobs = await this.store.listQueuedSignalBlobs();
      for (const entry of blobs) {
        breakdown.signalBlobs.attempted += 1;
        try {
          await this.eventScienceUploader.pushSignalBlob(entry.ref, entry.signals);
          await this.store.markSignalBlobSynced(entry.ref);
          breakdown.signalBlobs.uploaded += 1;
        } catch {
          break;
        }
      }
    }

    await fillRemaining(this.store, breakdown);
    return summarizeBreakdown(breakdown);
  }

  private async offlineResult(): Promise<FlushResult> {
    const breakdown = emptyBreakdown();
    await fillRemaining(this.store, breakdown);
    return summarizeBreakdown(breakdown);
  }
}

function emptyKindResult(): FlushKindResult {
  return { attempted: 0, uploaded: 0, remaining: 0 };
}

function emptyBreakdown(): FlushBreakdown {
  return {
    minuteRecords: emptyKindResult(),
    eventSummaries: emptyKindResult(),
    signalBlobs: emptyKindResult(),
  };
}

async function fillRemaining(store: LocalStore, breakdown: FlushBreakdown): Promise<void> {
  const [minuteRecords, eventSummaries, signalBlobs] = await Promise.all([
    store.listQueuedMinuteRecords(),
    store.listQueuedEventSummaries(),
    store.listQueuedSignalBlobs(),
  ]);
  breakdown.minuteRecords.remaining = minuteRecords.length;
  breakdown.eventSummaries.remaining = eventSummaries.length;
  breakdown.signalBlobs.remaining = signalBlobs.length;
}

function summarizeBreakdown(breakdown: FlushBreakdown): FlushResult {
  return {
    attempted:
      breakdown.minuteRecords.attempted + breakdown.eventSummaries.attempted + breakdown.signalBlobs.attempted,
    uploaded: breakdown.minuteRecords.uploaded + breakdown.eventSummaries.uploaded + breakdown.signalBlobs.uploaded,
    remaining: breakdown.minuteRecords.remaining + breakdown.eventSummaries.remaining + breakdown.signalBlobs.remaining,
    breakdown,
  };
}
