- `FirebaseProvider` (spec 0007): the first concrete `DataProvider`, over the munhub-1 Realtime
  Database. One factory (`createFirebaseProvider`) serves two SDK targets — the firebase modular
  client SDK (web) and `firebase-admin` (agent/tooling/server) — sharing all serialization and
  zod-boundary validation, with the backend SDK confined to `packages/data-provider` (D4/guardrail
  6). Incremental realtime listeners (`limitToLast` + `child_added`, never `once('value')`),
  minute writes idempotent on `(detector, ts)` keyed by zero-padded epoch-ms, a `/detector_index`
  for O(1) detector→station resolution, and memory-bounded streaming `exportAll`/`importAll` with
  per-chunk validation and quarantine. Ships a deny-by-default Phase A ruleset
  (`infra/firebase/database.rules.json`) and Firebase-Emulator integration + rules tests
  (`pnpm test:emulator`); the default `pnpm test` needs no emulator. Unblocks insights-v0 (0006),
  the station dashboards, and the v5→v6 migration engine.
