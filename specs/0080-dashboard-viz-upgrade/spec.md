# 0080 — Dashboards & visualization upgrade (comparison + spectrum + stats)

- **Status:** draft
- **Responsible:** Adjutant (spec) → Cursor (impl) → independent review → Adjutant (verify + macro + PR)
- **Depends on:** 0003 (schemas), 0005 (physics: spectrum, Poisson, baseline), 0006/0018 (station
  dashboard), 0075 (EventSummary). **Branches from `main`.**
- **Phase:** F2 · **Epic:** EPIC-5 · **Boundary:** `apps/web/**` + `packages/ui/**` ONLY.

## Context
0018 shipped the single-station dashboard (corrected rate + spectrum + insights). F2 calls for "many
more charts, spectra, statistics, comparison." This milestone delivers that visualization block.

## Functional requirements
- **FR1 — Multi-detector comparison:** overlay corrected-rate time-series for N selected detectors
  (`DataProvider.getMinuteRecords`) on a shared time axis, with optional normalization. Add/remove
  detectors; legend; empty/loading/error states.
- **FR2 — Spectrum panel upgrade:** render the `EventSummary` Landau-type amplitude spectrum
  (`getEventSummaries`) with log-y, a fit overlay (MPV/width via `@munhub/physics`), and an
  interval/range selector.
- **FR3 — Statistics panel:** Poisson stats, baseline & z-score deviations, rolling mean/σ, and
  data-quality (deadtime %, coverage) — all from existing physics + provider data.
- **FR4 — UI primitives:** new chart/panel components live in `packages/ui` (Observatory Dark,
  `docs/design/DESIGN-LANGUAGE.md`), consumed by `apps/web`.

## Non-functional
- Data ONLY via `DataProvider` (no backend SDK in web). **Scientific honesty:** single-SiPM =
  "charged-particle / MIP-type" rate, never "muons" (D9); nothing contradicting the theoretical
  foundation. Strict TS. Static-export compatible (Phase A). No white-screen on missing data/config.

## Acceptance criteria
1. Comparison view renders ≥2 detectors from provider data with a shared axis and normalization toggle.
2. Spectrum panel renders an `EventSummary` with the fit overlay and a working interval selector.
3. Statistics panel shows baseline + z-scores + rolling stats + data-quality from real provider data.
4. Pure components/util are unit-tested; `pnpm build·test·lint·typecheck` green; no white-screen guard
   holds when data is absent.

## Out of scope
Realtime streaming charts; admin pages; correlation-with-space-weather views (a later cell consumes
0081); export/reporting.

## Documentation (D42 — disjoint)
NEW `docs/technical/dashboards.md` + `changelog.d/dashboard-viz-upgrade.added.md` + spec status
`implemented`. **Do NOT edit** `docs/technical/DATA-MODEL.md`, `docs/technical/ARCHITECTURE.md`, or
`docs/STATUS.md` (orchestrator consolidates cross-cutting docs).
