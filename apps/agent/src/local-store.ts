import { EventSummarySchema, SignalRecordSchema, type EventSummary, type MinuteRecord, type SignalRecord } from "@munhub/shared";
import type { SignalBlobRef } from "@munhub/data-provider";

export interface StoredMinuteRecord {
  detectorId: string;
  record: MinuteRecord;
  synced: boolean;
}

export interface QueuedMinuteRecord {
  detectorId: string;
  record: MinuteRecord;
}

export interface StoredEventSummary {
  detectorId: string;
  summary: EventSummary;
  synced: boolean;
}

export interface QueuedEventSummary {
  detectorId: string;
  summary: EventSummary;
}

export interface StoredSignalBlob {
  ref: SignalBlobRef;
  signals: SignalRecord[];
  synced: boolean;
}

export interface QueuedSignalBlob {
  ref: SignalBlobRef;
  signals: SignalRecord[];
}

export interface LocalStore {
  saveMinuteRecord(detectorId: string, record: MinuteRecord): Promise<void>;
  getMinuteRecord(detectorId: string, ts: number): Promise<StoredMinuteRecord | null>;
  listMinuteRecords(detectorId?: string): Promise<StoredMinuteRecord[]>;
  queueMinuteRecord(detectorId: string, record: MinuteRecord): Promise<void>;
  listQueuedMinuteRecords(): Promise<QueuedMinuteRecord[]>;
  markMinuteRecordSynced(detectorId: string, ts: number): Promise<void>;
  queueEventSummary(summary: EventSummary): Promise<void>;
  listQueuedEventSummaries(): Promise<QueuedEventSummary[]>;
  markEventSummarySynced(detectorId: string, intervalStartTs: number): Promise<void>;
  queueSignalBlob(ref: SignalBlobRef, signals: readonly SignalRecord[]): Promise<void>;
  listQueuedSignalBlobs(): Promise<QueuedSignalBlob[]>;
  markSignalBlobSynced(ref: SignalBlobRef): Promise<void>;
}

function minuteKey(detectorId: string, ts: number): string {
  return `${detectorId}:${ts}`;
}

function eventSummaryKey(detectorId: string, intervalStartTs: number): string {
  return `${detectorId}:${intervalStartTs}`;
}

function signalBlobKey(ref: SignalBlobRef): string {
  return `${ref.detectorId}:${ref.sessionId}:${ref.intervalStartTs}`;
}

function sortByDetectorAndTimestamp(
  left: StoredMinuteRecord | QueuedMinuteRecord,
  right: StoredMinuteRecord | QueuedMinuteRecord,
): number {
  if (left.record.ts !== right.record.ts) {
    return left.record.ts - right.record.ts;
  }

  return left.detectorId.localeCompare(right.detectorId);
}

function sortByDetectorAndInterval(
  left: StoredEventSummary | QueuedEventSummary,
  right: StoredEventSummary | QueuedEventSummary,
): number {
  if (left.summary.intervalStartTs !== right.summary.intervalStartTs) {
    return left.summary.intervalStartTs - right.summary.intervalStartTs;
  }

  return left.detectorId.localeCompare(right.detectorId);
}

function sortBySignalBlobRef(left: StoredSignalBlob | QueuedSignalBlob, right: StoredSignalBlob | QueuedSignalBlob): number {
  if (left.ref.intervalStartTs !== right.ref.intervalStartTs) {
    return left.ref.intervalStartTs - right.ref.intervalStartTs;
  }

  const detectorOrder = left.ref.detectorId.localeCompare(right.ref.detectorId);
  if (detectorOrder !== 0) {
    return detectorOrder;
  }

  return left.ref.sessionId.localeCompare(right.ref.sessionId);
}

export class InMemoryLocalStore implements LocalStore {
  private readonly records = new Map<string, StoredMinuteRecord>();
  private readonly queuedKeys = new Set<string>();
  private readonly eventSummaries = new Map<string, StoredEventSummary>();
  private readonly queuedEventSummaryKeys = new Set<string>();
  private readonly signalBlobs = new Map<string, StoredSignalBlob>();
  private readonly queuedSignalBlobKeys = new Set<string>();

  async saveMinuteRecord(detectorId: string, record: MinuteRecord): Promise<void> {
    const key = minuteKey(detectorId, record.ts);
    const existing = this.records.get(key);
    this.records.set(key, {
      detectorId,
      record,
      synced: existing?.synced ?? false,
    });
  }

  async getMinuteRecord(detectorId: string, ts: number): Promise<StoredMinuteRecord | null> {
    return this.records.get(minuteKey(detectorId, ts)) ?? null;
  }

  async listMinuteRecords(detectorId?: string): Promise<StoredMinuteRecord[]> {
    return [...this.records.values()]
      .filter((entry) => detectorId === undefined || entry.detectorId === detectorId)
      .sort(sortByDetectorAndTimestamp);
  }

  async queueMinuteRecord(detectorId: string, record: MinuteRecord): Promise<void> {
    const key = minuteKey(detectorId, record.ts);
    await this.saveMinuteRecord(detectorId, record);

    const stored = this.records.get(key);
    if (stored?.synced === true) {
      return;
    }

    this.queuedKeys.add(key);
  }

  async listQueuedMinuteRecords(): Promise<QueuedMinuteRecord[]> {
    return [...this.queuedKeys]
      .map((key) => this.records.get(key))
      .filter((entry): entry is StoredMinuteRecord => entry !== undefined && !entry.synced)
      .map((entry) => ({ detectorId: entry.detectorId, record: entry.record }))
      .sort(sortByDetectorAndTimestamp);
  }

  async markMinuteRecordSynced(detectorId: string, ts: number): Promise<void> {
    const key = minuteKey(detectorId, ts);
    const existing = this.records.get(key);
    if (existing !== undefined) {
      this.records.set(key, { ...existing, synced: true });
    }

    this.queuedKeys.delete(key);
  }

  async queueEventSummary(summary: EventSummary): Promise<void> {
    const parsed = EventSummarySchema.parse(summary);
    const key = eventSummaryKey(parsed.detectorId, parsed.intervalStartTs);
    const existing = this.eventSummaries.get(key);
    if (existing !== undefined) {
      return;
    }

    this.eventSummaries.set(key, {
      detectorId: parsed.detectorId,
      summary: parsed,
      synced: false,
    });
    this.queuedEventSummaryKeys.add(key);
  }

  async listQueuedEventSummaries(): Promise<QueuedEventSummary[]> {
    return [...this.queuedEventSummaryKeys]
      .map((key) => this.eventSummaries.get(key))
      .filter((entry): entry is StoredEventSummary => entry !== undefined && !entry.synced)
      .map((entry) => ({ detectorId: entry.detectorId, summary: entry.summary }))
      .sort(sortByDetectorAndInterval);
  }

  async markEventSummarySynced(detectorId: string, intervalStartTs: number): Promise<void> {
    const key = eventSummaryKey(detectorId, intervalStartTs);
    const existing = this.eventSummaries.get(key);
    if (existing !== undefined) {
      this.eventSummaries.set(key, { ...existing, synced: true });
    }

    this.queuedEventSummaryKeys.delete(key);
  }

  async queueSignalBlob(ref: SignalBlobRef, signals: readonly SignalRecord[]): Promise<void> {
    const key = signalBlobKey(ref);
    const existing = this.signalBlobs.get(key);
    if (existing !== undefined) {
      return;
    }

    const parsedSignals = signals.map((signal) => SignalRecordSchema.parse(signal));
    this.signalBlobs.set(key, {
      ref: { ...ref },
      signals: parsedSignals,
      synced: false,
    });
    this.queuedSignalBlobKeys.add(key);
  }

  async listQueuedSignalBlobs(): Promise<QueuedSignalBlob[]> {
    return [...this.queuedSignalBlobKeys]
      .map((key) => this.signalBlobs.get(key))
      .filter((entry): entry is StoredSignalBlob => entry !== undefined && !entry.synced)
      .map((entry) => ({ ref: entry.ref, signals: entry.signals }))
      .sort(sortBySignalBlobRef);
  }

  async markSignalBlobSynced(ref: SignalBlobRef): Promise<void> {
    const key = signalBlobKey(ref);
    const existing = this.signalBlobs.get(key);
    if (existing !== undefined) {
      this.signalBlobs.set(key, { ...existing, synced: true });
    }

    this.queuedSignalBlobKeys.delete(key);
  }
}
