# 0078 — Wire the agent's event science to the provider (upload + offline queue)

- **Status:** implemented
- **Responsible:** Adjutant (spec) → Cursor (impl) → independent review (Gemini — re-probe first; Cursor review-only if down) → Adjutant (verify + macro + PR)
- **Depends on:** 0076 (the pipeline emits `EventSummary` / `SignalRecord` / complete-raw), 0077 (the provider persists them: `putEventSummary`, `putSignalBlob`), 0013 (`OfflineSyncQueue` + `LocalStore`). Branches from `main`.
- **Phase:** F2 · **Epic:** EPIC-2 · **Source:** ADR-003 (the agent must actually upload what it computes); 0077 "out of scope: agent UPLOADING via these methods — a thin follow-up".

## Context
`AgentEventSciencePipeline` (0076) returns `EventSciencePipelineOutput` (`eventSummaries`,
`signalRecords`, `completeRawReadings`) but **nothing uploads it** — the outputs are dropped on the
floor. 0077 added the provider sink (`putEventSummary`, `putSignalBlob`). This milestone closes the
loop the same way minute records already work (`OfflineSyncQueue` → `MinuteRecordUploader`): an
offline-durable, idempotent queue that flushes the science outputs to the provider, **respecting the
selected storage tier**.

## Functional requirements

### FR1 — Uploader port (`apps/agent`)
Define an `EventScienceUploader` interface (the agent's view of the provider, no SDK import):
- `pushEventSummary(summary: EventSummary): Promise<void>`
- `pushSignalBlob(ref: SignalBlobRef, signals: SignalRecord[]): Promise<void>`
A thin adapter binds it to a `DataProvider` (`putEventSummary` / `putSignalBlob`). The existing
`MinuteRecordUploader` stays; this is additive.

### FR2 — Durable queue for science outputs (`LocalStore` + queue)
Extend `LocalStore` with queue/list/mark-synced methods for **event summaries** (keyed by
`detectorId` + `intervalStartTs`) and **signal blobs** (keyed by `SignalBlobRef`). Mirror the minute
pattern (`queue… / listQueued… / mark…Synced`). The in-memory store implements them; the queue keys
are deduplicated so re-enqueueing the same key is a no-op.

### FR3 — Enqueue from pipeline output (tier-aware)
A `routePipelineOutput(output, ctx)` step maps an `EventSciencePipelineOutput` into queue entries,
honoring the `StorageTierConfig`:
- `eventSummaries` → always enqueued when present (they are the slim queryable record).
- `signalRecords` → batched **per `intervalStartTs`** into one `SignalBlobRef =
  { detectorId, sessionId, intervalStartTs }` and enqueued **only when `tier.individualSignals`**.
- `completeRawReadings` → serialized as `SignalRecord[]` blobs per interval and enqueued **only when
  `tier.completeRaw.enabled`** (reuse FR2's blob queue; a distinct path prefix is out of scope —
  0077's `signals/...` layout is acceptable for now, keyed by the same ref).
- **`cloudRealtime: "local-only"` / `"none"`** must **not** enqueue blobs for upload (local realtime
  stays local); `eventSummaries` still upload. Document the matrix in the file header.

### FR4 — Idempotent flush
Extend the offline-sync flow so a flush uploads queued event summaries and signal blobs in addition
to minute records: on success `mark…Synced`; on the first failure **stop** (preserve order, leave the
rest queued — same back-pressure as today). A re-flush of an already-synced key must **not**
re-upload (idempotency via the dedup keys). `FlushResult` reports the combined counts (extend the
type; keep `attempted/uploaded/remaining` semantics, add per-kind breakdown).

## Non-functional
- Strict TS, no `any`. **No backend SDK in `apps/agent`** — only the `EventScienceUploader` port +
  `DataProvider` types (guardrail 6). Validate at the boundary with the shared schemas already used
  by the pipeline (no re-coercion of scientific values; guardrail 4/5).
- Pure-TS core stays testable without Tauri. Default `pnpm test` (no emulator) covers this with the
  in-memory store + a fake uploader.

## Acceptance criteria
1. `routePipelineOutput` enqueues exactly: every `EventSummary`; one signal blob per interval **iff**
   `individualSignals`; one complete-raw blob per interval **iff** `completeRaw.enabled`; and **no**
   blobs when `cloudRealtime` is `local-only`/`none` (summaries still enqueued).
2. With a fake uploader, a flush uploads all queued summaries + blobs, marks them synced, and a
   second flush uploads nothing (idempotent).
3. A failing uploader stops the flush at the first failure, leaving the remaining entries queued;
   the next flush resumes and completes them (no duplicates, no loss).
4. No backend SDK imported in `apps/agent`; the agent depends only on the port + `DataProvider`
   types. `pnpm build·test·lint·typecheck` green.

## Out of scope (later)
- The Tauri online/offline trigger wiring to real network state, and the real provider binding in the
  desktop shell (a desktop-integration milestone).
- Retention/TTL enforcement, dedup across sessions, blob path namespacing for complete-raw vs signals,
  compaction. Admin console, runway, federation.

## Documentation (D42)
- `docs/technical/ARCHITECTURE.md` (agent upload path: pipeline → queue → provider), `docs/technical/
  DATA-MODEL.md` (tier→upload matrix), spec status, `docs/STATUS.md` (Adjutant),
  `changelog.d/agent-event-upload.added.md`.
