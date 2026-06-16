# 0079 — Agent desktop runtime: bind core → provider → Tauri shell

- **Status:** draft
- **Responsible:** Adjutant (spec) → Cursor (impl) → independent review → Adjutant (verify + macro + PR)
- **Depends on:** 0013 (agent core: serial parse, aggregation, `OfflineSyncQueue`), 0076 (science pipeline), 0078 (upload wiring). **Branches from `spec/0078-agent-event-upload`** (stacked — 0078 not yet merged).
- **Phase:** F2 · **Epic:** EPIC-4 · **Boundary:** `apps/agent/**` ONLY.

## Context
The agent has the pieces — serial parsing, per-minute aggregation (0013), the event-science pipeline
(0076), the upload queue (0078) — but nothing binds them into a running desktop session over a real
`DataProvider`. This milestone adds the runtime.

## Functional requirements (all in `apps/agent`)
- **FR1 — Provider binding (boundary):** construct a `FirebaseProvider` at the app entry and bind it
  to `MinuteRecordUploader` + `EventScienceUploader` (0078). The core stays provider-agnostic
  (depends on the ports, not the SDK).
- **FR2 — `SessionController` (pure TS):** owns serial source → parser → aggregate (`MinuteRecord`) +
  `AgentEventSciencePipeline` (EventSummary/SignalRecord/raw) → `OfflineSyncQueue`. `start()/stop()`,
  carries the selected `StorageTierConfig` (incl. the **Recommended** default), exposes live status
  (rate, queue depth, last-sync, active calibration).
- **FR3 — Online/offline:** detect connectivity and drive `queue.setOnline()` / `flush()`; offline →
  durable local buffer, online → flush. No data loss across transitions.
- **FR4 — Control surface:** thin Tauri commands + a minimal UI — start/stop, serial-port pick (reuse
  `ui/port-picker`), tier select (with Recommended button), live status. Tauri commands are thin
  adapters over `SessionController`.

## Non-functional
- `SessionController` and all logic are plain TS, unit-testable **without Tauri** (Tauri layer = thin
  adapters only). Backend access only through the provider package (the boundary). Strict TS, no `any`.

## Acceptance criteria
1. With fakes (serial source, `InMemoryLocalStore`, fake uploaders), a stream of raw readings produces
   `MinuteRecord`s + `EventSummary`s enqueued and flushed while online; offline buffers and then
   flushes losslessly on reconnect; tier selection routes uploads per 0078 (`local-only`/`none` → no
   blob upload).
2. `start()/stop()` are idempotent and tear down the serial stream cleanly.
3. No backend SDK imported in `apps/agent` outside the provider package import. `pnpm
   build·test·lint·typecheck` green.

## Out of scope
Real Tauri e2e on hardware; installer/packaging; auto-update; multi-detector sessions.

## Documentation (D42 — disjoint)
NEW `apps/agent/docs/desktop-runtime.md` + `changelog.d/agent-desktop-runtime.added.md` + set this
spec status to `implemented`. **Do NOT edit** `docs/technical/DATA-MODEL.md`,
`docs/technical/ARCHITECTURE.md`, or `docs/STATUS.md` (orchestrator consolidates cross-cutting docs).
