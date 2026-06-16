# 0082 — Storage runway + admit-control engine (deterministic)

- **Status:** draft
- **Responsible:** Adjutant (spec) → Cursor (impl) → independent review (Gemini, API-key) → Adjutant
  (verify + macro + PR)
- **Depends on:** 0074/0075 (`StorageQuota` schema, realtime cap), 0077 (blob storage). **Branches
  from `main`.**
- **Phase:** F5 · **Epic:** EPIC-8/9 · **Boundary:** NEW `packages/storage-runway/**` +
  `packages/data-provider/**` ONLY (consume the existing `StorageQuota` from `@munhub/shared`; do NOT
  modify `packages/shared`).

## Context
ADR-003 / storage federation needs a **deterministic, explainable** (non-ML) capacity layer before
the admin console and DB federation: "there is X space, enough for ~N days," plus admit-control that
enforces the cap (the 1 GB-class guard) instead of silently overflowing.

## Functional requirements
- **FR1 — Runway engine (`packages/storage-runway`, PURE):** given a `StorageQuota`
  (used/limit bytes) + a recent write-rate sample (bytes/interval), compute `bytesRemaining`,
  `estimatedDaysRemaining` (deterministic linear projection over the sampled rate), and a
  `RunwayStatus` (`healthy`/`warning`/`critical` by configurable thresholds). Fully unit-tested.
- **FR2 — Admit-control:** `shouldAccept(write, quota, policy)` → `allow` / `deny` / `divert` with a
  human-readable reason; enforces the cap deterministically (e.g. deny realtime writes past the cap,
  divert cold data). Pure, table-tested.
- **FR3 — Provider quota surface (`packages/data-provider`):** extend `DataProvider`/`FirebaseProvider`
  with `getStorageQuota(scope)` reading usage (RTDB subtree-size estimate + Cloud Storage usage) into
  the existing `StorageQuota` shape. SDK stays in `data-provider` (guardrail 6).
- **FR4 — Capacity events:** emit a typed `CapacityNotification` (local type) on crossing
  warning/critical — surface the event only (no transport/UI yet).

## Non-functional
- Deterministic and explainable (NO ML, NO hidden heuristics — every number traceable to inputs).
  Strict TS, no `any`. Numeric tests for the projection; SDK only in `data-provider`.

## Acceptance criteria
1. Runway projection + admit-control pass numeric tests incl. boundaries: exactly at cap, zero rate
   (→ infinite/none runway, well-defined), constant rate, accelerating rate.
2. `getStorageQuota` returns a valid `StorageQuota` from the emulator (or a clearly-documented
   estimate path); crossing thresholds yields the correct `CapacityNotification`.
3. `pnpm build·test·lint·typecheck` green; the data-provider emulator job stays green.

## Out of scope
Cross-DB federation/placement, admin UI, R2 cold archive, real notification transport (email/in-app),
ML forecasting.

## Documentation (D42 — disjoint)
NEW `packages/storage-runway/README.md` + `docs/technical/storage-runway.md` +
`changelog.d/storage-runway-engine.added.md` + spec status `implemented`. **Do NOT edit**
`docs/technical/DATA-MODEL.md`, `docs/technical/ARCHITECTURE.md`, or `docs/STATUS.md`.
