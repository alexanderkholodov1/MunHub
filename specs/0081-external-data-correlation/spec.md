# 0081 — External space-weather ingestion + correlation (greenfield)

- **Status:** draft
- **Responsible:** Adjutant (spec) → Cursor (impl) → **Claude security-reviewer** (untrusted external
  HTTP input) → Adjutant (verify + macro + PR)
- **Depends on:** 0002 (data layer is provider-agnostic), 0005 (physics conventions). **Branches from
  `main`.**
- **Phase:** F4 · **Epic:** EPIC-7 · **Boundary:** NEW `packages/external-data/**` + NEW files
  `packages/physics/src/correlation*.ts` (append exports to `packages/physics` index only) ONLY.

## Context
Cosmic-ray rate correlates with space weather — Forbush decreases from CMEs, solar/geomagnetic
activity. This greenfield layer ingests external indices (provider-agnostic) and adds the correlation
physics, so later cells can show event-overlay views. No collision with existing packages.

## Functional requirements
- **FR1 — External index domain (local types in `packages/external-data`, NOT `packages/shared`):**
  `NeutronMonitorRecord` (NMDB neutron counts), `GeomagneticIndexRecord` (Kp/Dst), `SolarEventRecord`
  (DONKI CME/flare). Each a zod-validated shape defined locally in this package.
- **FR2 — Source adapters behind an `ExternalDataSource` interface:** NMDB, NOAA SWPC (Kp/Dst), NASA
  DONKI (CME/flare). HTTP fetch + parse + validate; **all network code isolated in this package**;
  malformed rows quarantined/skipped, **never coerced**; endpoints/keys configurable, **no secret
  committed**.
- **FR3 — Correlation physics (`packages/physics`, PURE, new files):** resample a detector rate series
  and an external series to common bins; Pearson + Spearman correlation; lagged cross-correlation
  (find best lag); a deterministic Forbush-decrease detector (drop magnitude + duration). **Numeric
  tests mandatory** (physics rule).
- **FR4 — `ExternalDataProvider` facade:** `getNeutronMonitor(range)` / `getGeomagnetic(range)` /
  `getSolarEvents(range)` over the adapters — provider-agnostic, swappable.

## Non-functional
- **Untrusted input:** validate everything at the boundary, never coerce scientific values
  (guardrail 4/5); no key leakage; handle timeouts/HTTP errors/malformed payloads gracefully. Strict
  TS, no `any`. Correlation functions fully unit-tested on synthetic series.

## Acceptance criteria
1. Each adapter parses a representative sample into validated records and drops malformed rows without
   coercion.
2. Pearson/Spearman, lagged cross-correlation, and the Forbush detector pass numeric tests on
   synthetic data (known-answer cases incl. zero/anti correlation and a planted Forbush dip).
3. No secret committed; network failures handled (no unhandled rejection). `pnpm
   build·test·lint·typecheck` green.

## Out of scope
Live ingestion scheduling/cron; dashboard correlation views (later cell); persisting external series
into Firebase; rate limiting/backoff tuning.

## Documentation (D42 — disjoint)
NEW `packages/external-data/README.md` + `docs/technical/external-correlation.md` +
`changelog.d/external-data-correlation.added.md` + spec status `implemented`. **Do NOT edit**
`docs/technical/DATA-MODEL.md`, `docs/technical/ARCHITECTURE.md`, or `docs/STATUS.md`.
