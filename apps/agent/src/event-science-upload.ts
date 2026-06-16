/**
 * Tier-aware upload routing for agent event-science outputs.
 *
 * Upload matrix:
 * - EventSummary: always queued for provider upload.
 * - SignalRecord blobs: queued by detector/session/interval only when
 *   storageTier.individualSignals is enabled and realtimeMode is "cloud-volatile".
 * - Complete-raw readings: converted to SignalRecord-compatible blobs by interval only when
 *   storageTier.completeRaw.enabled and realtimeMode is "cloud-volatile".
 * - realtimeMode "local-only" or "none": no blobs are queued; EventSummary records still upload.
 */
import {
  EpochMsSchema,
  EventSummarySchema,
  IdSchema,
  SignalRecordSchema,
  StorageTierConfigSchema,
  type EventSummary,
  type SignalRecord,
  type StorageTierConfig,
} from "@munhub/shared";
import type { DataProvider, SignalBlobRef } from "@munhub/data-provider";
import type { EventSciencePipelineOutput } from "./event-science-pipeline.js";
import type { LocalStore } from "./local-store.js";
import type { RawReading } from "./parsers/index.js";

export interface EventScienceUploader {
  pushEventSummary(summary: EventSummary): Promise<void>;
  pushSignalBlob(ref: SignalBlobRef, signals: SignalRecord[]): Promise<void>;
}

export class DataProviderEventScienceUploader implements EventScienceUploader {
  private readonly provider: Pick<DataProvider, "putEventSummary" | "putSignalBlob">;

  constructor(provider: Pick<DataProvider, "putEventSummary" | "putSignalBlob">) {
    this.provider = provider;
  }

  async pushEventSummary(summary: EventSummary): Promise<void> {
    await this.provider.putEventSummary(EventSummarySchema.parse(summary));
  }

  async pushSignalBlob(ref: SignalBlobRef, signals: SignalRecord[]): Promise<void> {
    await this.provider.putSignalBlob(parseSignalBlobRef(ref), signals.map((signal) => SignalRecordSchema.parse(signal)));
  }
}

export interface RoutePipelineOutputContext {
  readonly store: Pick<LocalStore, "queueEventSummary" | "queueSignalBlob">;
  readonly detectorId: string;
  readonly sessionId: string;
  readonly storageTier: StorageTierConfig;
}

interface SignalBlobGroup {
  readonly ref: SignalBlobRef;
  readonly signals: SignalRecord[];
  readonly signalKeys: Set<string>;
}

export async function routePipelineOutput(
  output: EventSciencePipelineOutput,
  context: RoutePipelineOutputContext,
): Promise<void> {
  const tier = StorageTierConfigSchema.parse(context.storageTier);

  for (const summary of output.eventSummaries) {
    await context.store.queueEventSummary(EventSummarySchema.parse(summary));
  }

  if (!shouldUploadSignalBlobs(tier)) {
    return;
  }

  const groups = new Map<string, SignalBlobGroup>();
  if (tier.completeRaw.enabled) {
    for (const reading of output.completeRawReadings) {
      addSignalToGroup(groups, context, tier, rawReadingToSignalRecord(reading));
    }
  }

  if (tier.individualSignals) {
    for (const signal of output.signalRecords) {
      addSignalToGroup(groups, context, tier, SignalRecordSchema.parse(signal));
    }
  }

  for (const group of [...groups.values()].sort(sortSignalBlobGroups)) {
    await context.store.queueSignalBlob(group.ref, group.signals);
  }
}

function shouldUploadSignalBlobs(tier: StorageTierConfig): boolean {
  return tier.realtimeMode === "cloud-volatile";
}

function addSignalToGroup(
  groups: Map<string, SignalBlobGroup>,
  context: RoutePipelineOutputContext,
  tier: StorageTierConfig,
  signal: SignalRecord,
): void {
  const intervalStartTs = intervalStartForTimestamp(signal.ts, tier.eventSummaryIntervalMs);
  const ref = parseSignalBlobRef({
    detectorId: context.detectorId,
    sessionId: context.sessionId,
    intervalStartTs,
  });
  const key = signalBlobKey(ref);
  const group = groups.get(key) ?? {
    ref,
    signals: [],
    signalKeys: new Set<string>(),
  };
  const signalKey = signalIdentity(signal);
  if (!group.signalKeys.has(signalKey)) {
    group.signalKeys.add(signalKey);
    group.signals.push(signal);
  }
  groups.set(key, group);
}

function rawReadingToSignalRecord(reading: RawReading): SignalRecord {
  const signalBase = {
    ts: reading.timestamp,
    sipmMv: reading.sipmMv,
    coincident: reading.coincident > 0,
    deadtimeUs: reading.deadtimePercent === undefined ? 0 : (reading.deadtimePercent / 100) * 1_000_000,
  };
  const signal: SignalRecord = { ...signalBase };

  if (reading.adc1 !== undefined) {
    signal.adc1 = Math.trunc(reading.adc1);
  }
  if (reading.adc2 !== undefined) {
    signal.adc2 = Math.trunc(reading.adc2);
  }
  if (reading.tempC !== undefined) {
    signal.tempC = reading.tempC;
  }
  if (reading.pressurePa !== undefined) {
    signal.pressureHpa = reading.pressurePa / 100;
  }

  return SignalRecordSchema.parse(signal);
}

function intervalStartForTimestamp(ts: number, intervalMs: number): number {
  return Math.floor(EpochMsSchema.parse(ts) / intervalMs) * intervalMs;
}

function parseSignalBlobRef(ref: SignalBlobRef): SignalBlobRef {
  return {
    detectorId: IdSchema.parse(ref.detectorId),
    sessionId: IdSchema.parse(ref.sessionId),
    intervalStartTs: EpochMsSchema.parse(ref.intervalStartTs),
  };
}

function signalBlobKey(ref: SignalBlobRef): string {
  return `${ref.detectorId}:${ref.sessionId}:${ref.intervalStartTs}`;
}

function signalIdentity(signal: SignalRecord): string {
  return [
    signal.ts,
    signal.sipmMv,
    signal.adc1 ?? "",
    signal.adc2 ?? "",
    signal.coincident,
    signal.deadtimeUs,
    signal.tempC ?? "",
    signal.pressureHpa ?? "",
  ].join("|");
}

function sortSignalBlobGroups(left: SignalBlobGroup, right: SignalBlobGroup): number {
  if (left.ref.intervalStartTs !== right.ref.intervalStartTs) {
    return left.ref.intervalStartTs - right.ref.intervalStartTs;
  }

  const detectorOrder = left.ref.detectorId.localeCompare(right.ref.detectorId);
  if (detectorOrder !== 0) {
    return detectorOrder;
  }

  return left.ref.sessionId.localeCompare(right.ref.sessionId);
}
