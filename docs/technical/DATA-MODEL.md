# MunHub Lab — Data model (technical overview)

> Public, English distillation of [`planning/02-DATA-MODEL.md`](../../planning/02-DATA-MODEL.md).
> The authoritative, validated definitions live in **`packages/shared`** as Zod schemas with
> inferred TypeScript types (implemented in spec S03) — schemas are the single source of truth, so
> runtime validation and compile-time types can never drift.

## 1. Vocabulary (the two-level model)

The word "detector" used to mean both a physical device and a user profile. v6 separates them:

| Term | What it is |
|---|---|
| **Institution** | A university/organization grouping users and stations. |
| **User** | A person's account. |
| **Station** | The registered **profile / site**: location, metadata, visibility. This is what appears on the map and has an owner. |
| **Detector** | The physical **CosmicWatch device** inside a station: device token, firmware, calibration. **Data belongs to a detector.** |
| **Session** | One data-taking run of a detector. |

> "Detector" now always means the physical device. "Station" is the profile/site.

## 2. Relationships

```
Institution 1 ─ N User         (a user may also be independent — no institution)
Institution 1 ─ N Station
User        1 ─ N Station      (owner; plus shares for collaboration)
Station     1 ─ N Detector     (usually 1; ≥2 enables a coincidence telescope)
Detector    1 ─ N Session
Detector    1 ─ N MinuteRecord (time series, indefinite retention)
Detector    1 ─ N RealtimeRecord (short window, expires)
```

Data (sessions, minute records, realtime) hangs off the **detector**, because calibration is
per-device. For the 99% case (one detector per station) the UI presents this transparently; the
station view aggregates its detectors.

## 3. Minute record (the scientific core)

Stored indefinitely. **All values are averages, never sums** — a data-integrity requirement.

| Field | Unit | Meaning |
|---|---|---|
| `ts` | epoch ms | start of the minute |
| `ec` | counts/min | event rate (charged particles) |
| `cc` | counts/min | coincidences/min (meaningful only for coincidence stations) |
| `sm` / `sx` / `sn` | mV | SiPM amplitude average / max / min |
| `tp` | °C | temperature |
| `pr` | hPa | atmospheric pressure |
| `dt` | % | dead time |
| *derived (in `packages/physics`)* | | |
| `ec_dt` | counts/min | dead-time corrected: `R / (1 − R·τ_DT)` |
| `ec_corr` | counts/min | barometric corrected (over `ec_dt`), **local β by regression** |
| `flux` | 1/cm²/min | if an effective area is configured |

**Corrections pipeline (mandatory order):** raw → dead-time → barometric (local β) → thermal.

> Reconciled from v5: canonical dead-time is `dt` (not `d`); pressure in hPa; `cc` = coincidences,
> never "muons" (see scientific note below).

## 4. Realtime record

Per-event: `ts`, `sipm_mv`, `temp`, `deadtime`, … Short retention (8-minute sliding window; capped
at 5000 records in Firebase). Powers the 1m/5m chart views; auto-expires.

## 5. Required metadata (highlights)

- **Station:** name, owner, **visibility** (public/institution/private — *explicit choice, no
  default*), latitude/longitude/altitude (manual entry), city, country, placement
  (ground/indoor/basement/…), type (single/coincidence), timezone. More metadata is always better.
- **Detector:** auto-generated device token (non-blocking), hardware model & firmware version,
  `hw_version` (defines τ_DT — v2 ≈ 50 ms, v3X ≈ 400 µs), SiPM count, calibration (sensible
  defaults by hardware + optional advanced override).

## 6. Scientific note on `cc` / "muons"

A single SiPM cannot distinguish muon/electron/gamma (all minimum-ionizing, ~2 MeV). Therefore:

- **Single-detector station:** the primary metric is the **charged-particle / MIP-type rate**, with
  the **amplitude (Landau) spectrum** — *not* "muons".
- **Coincidence station (≥2 detectors):** `cc` is a genuine muon selection (>99% purity).

UI labels and tooltips take their exact wording from
[`../research/THEORETICAL-FOUNDATION.md`](../research/THEORETICAL-FOUNDATION.md).

## 7. Backends

- **Phase A — Firebase Realtime Database (munhub-1), via `FirebaseProvider` (spec 0007):**

  ```
  /users/{uid}
  /institutions/{id}
  /stations/{id}                         → ownerUid, visibility, shares/{uid}, …
    └─ detectors/{detId}
         ├─ sessions/{sid}               (session metadata only)
         ├─ minutes/{ts}                 (MinuteRecord; ts = zero-padded epoch-ms key, ordered)
         ├─ realtime/{ts}                (RealtimeRecord; capped sliding window)
         └─ latest                       (denormalized most-recent MinuteRecord)
  /detector_index/{detId}                → stationId   (O(1) detector→station resolution)
  ```

  Two reconciliations the provider pins versus the earlier sketch: (1) the queryable **minute
  series is stored directly under the detector** (`…/detectors/{detId}/minutes/{ts}`), not under
  `sessions/{sid}`, so range queries by `(detectorId, ts)` need no cross-session scan — `sessions`
  keeps run metadata only; (2) **`/detector_index`** denormalizes detector→station so the by-id
  interface methods resolve in one read. Deny-by-default rules live in
  `infra/firebase/database.rules.json` (the legacy v5 ruleset at the repo root `database.rules.json`
  is separate and untouched). Stored field names are the camelCase schema keys.
- **Phase B — Postgres + TimescaleDB:** hypertables for `minute_records` / `realtime_records`,
  continuous aggregates for long-range charts, row-level security mirroring Phase A rules.
