# MunHub Lab

<div align="center">

**A scientific platform for cosmic-ray detector monitoring — built for a multi-university network in Latin America.**

<img src="https://img.shields.io/badge/status-pre--alpha-orange" alt="Status: pre-alpha">
<img src="https://img.shields.io/badge/version-6.0.0--alpha.1-blue" alt="Version">
<img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT">
<img src="https://img.shields.io/badge/data-CC--BY%204.0-green" alt="Data: CC-BY 4.0">
<img src="https://img.shields.io/badge/i18n-EN%20%7C%20ES%20%7C%20PT--BR-lightgrey" alt="Languages">

</div>

---

> ### 🚧 Status: pre-alpha — active reconstruction (v6)
> MunHub is being **rebuilt from the ground up** as a professional, typed, multi-package platform.
> The previous **v5** application (vanilla JS + Firebase) still lives in [`public/`](public/) as a
> working reference and is **not** the direction of this codebase. **v6 is not yet usable** — this
> repository currently contains the foundations (monorepo, CI, contracts, science layer) and the
> full design/engineering plan. Follow progress in [`docs/STATUS.md`](docs/STATUS.md).

---

## What is MunHub?

Small scintillation detectors (CosmicWatch-class, running MuNRa firmware) continuously count the
charged particles that reach the ground from cosmic-ray showers. MunHub lets a university, a lab,
or an independent researcher **connect such a detector, store its data safely, visualize it, and
correlate it with space-weather events** — and lets many stations across Latin America form a
**shared scientific network**.

Ecuador sits under the **highest geomagnetic cutoff rigidity on the planet** (~14–17 GV), which
makes its ground-level cosmic-ray signal unusually clean — a genuine scientific reason for this
network to exist.

### Scientific honesty (read this)
A single-SiPM detector **cannot** cleanly separate muons from electrons or gammas (all behave as
minimum-ionizing particles, ~2 MeV). MunHub therefore reports a **charged-particle / MIP-type
rate** and an **amplitude (Landau) spectrum**, *not* a "muon count" — unless a coincidence
telescope (≥2 detectors) confirms muons. All corrections (dead-time, local barometric β) are
mandatory, not optional. See [`docs/research/THEORETICAL-FOUNDATION.md`](docs/research/THEORETICAL-FOUNDATION.md).

---

## Why a rebuild?

The v5 app proved the concept but hit its ceiling: ~9,700 lines of untyped vanilla JS in 12 global
modules, no tests, a saturated free-tier database, manual Python scripts for serial reading, and no
real offline guarantee. v6 addresses all of this with a typed monorepo, a provider-agnostic data
layer, an installable agent with local backup, a solid scientific foundation, and a design system.

---

## Architecture at a glance

```
[USB detector] ──serial──▶ apps/agent (Tauri)            apps/web (Next.js)
     USFQ                  ├ reads serial                 ├ public landing
                           ├ SQLite local backup          ├ station dashboards
                           └ offline sync queue ─┐        └ admin console
                                                 │              ▲
                                                 ▼              │
                                    packages/data-provider ─────┘
                              (FirebaseProvider today · SupabaseProvider later)
                                                 ▲
        ┌──────────── shared foundations ────────┴───────────────┐
        packages/shared        packages/physics       packages/ui
        (types + zod schemas)  (dead-time, β, flux,    (design system:
         = the contracts        Landau spectrum)        Observatory Dark)
```

- **Provider-agnostic data:** the app never calls Firebase/Supabase directly — only through
  `packages/data-provider`. Switching backends = swapping one implementation.
- **Offline-first at the edge:** the agent persists locally before syncing; the detector never
  loses data.
- **Scientific integrity by contract:** invariants (averages never sums, no event filtering) are
  validated with `zod` in `packages/shared`, not by convention.

Full design: [`planning/01-ARCHITECTURE.md`](planning/01-ARCHITECTURE.md) ·
[`docs/technical/ARCHITECTURE.md`](docs/technical/ARCHITECTURE.md).

---

## Repository structure

```
apps/
  web/                 Next.js app — landing, dashboards, admin (static export, Phase A)
  agent/               Tauri app — serial reading, SQLite backup, sync queue
services/
  api/                 Backend / edge functions (Phase B)
  ai/                  ML pipeline — anomaly & Forbush detection, barometric β (Phase B)
packages/
  shared/              Types, zod schemas, constants, i18n keys — the contracts
  physics/             Pure scientific calculations (no I/O, fully testable)
  data-provider/       DataProvider interface + Firebase/Supabase implementations
  ui/                  Design system (Tailwind + shadcn/ui + Plotly) — "Observatory Dark"
specs/                 Spec-Driven Development: one spec per unit of work
docs/                  Technical docs, user manual, design language, scientific foundation
planning/              Internal master plan, architecture, data model, decisions (D1–D39)
infra/                 CI, fleet tooling, deployment
public/                v5 app (reference only — not the v6 direction)
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js (React) · Tailwind · shadcn/ui · Plotly · MapLibre |
| Agent | Tauri (Rust shell + web UI) · SQLite |
| Data (Phase A) | Firebase: Realtime Database, Auth, Storage, Hosting |
| Data (Phase B) | Supabase self-hosted + TimescaleDB |
| Cold backups | Cloudflare R2 |
| Quality | Vitest · ESLint · Prettier · gitleaks · GitHub Actions CI |

---

## Getting started (development)

> Requires Node ≥ 20 and pnpm ≥ 9.

```bash
pnpm install
pnpm build        # build all packages (Turborepo)
pnpm test         # run the test suites
pnpm lint         # lint
pnpm typecheck    # strict type checking
```

There is no runnable app yet — the foundations build and the quality gate is green. The first
end-to-end vertical slice (station + detector → agent → dashboard with live corrected rate +
spectrum) is the goal of Phase 1.

---

## How this project is built

MunHub is developed with **Spec-Driven Development** and a coordinated **multi-provider agent
fleet** (see [`AGENTS.md`](AGENTS.md) and [`planning/18-AGENT-FLEET-ORCHESTRATION.md`](planning/18-AGENT-FLEET-ORCHESTRATION.md)):

- No code without a spec in [`specs/`](specs/).
- Every change lands via a **pull request**; CI (build · test · lint · typecheck · secret scan)
  must be green; `main` is protected and only the maintainer merges.
- All code is in **English**; the UI is internationalized (EN · ES · PT-BR).

---

## Documentation

| Doc | What |
|---|---|
| [`docs/technical/`](docs/technical/) | Architecture, data model, serial formats (for contributors) |
| [`docs/user-manual/`](docs/user-manual/) | Concepts and terminology for end users (preliminary) |
| [`docs/design/DESIGN-LANGUAGE.md`](docs/design/DESIGN-LANGUAGE.md) | "Observatory Dark" visual contract |
| [`docs/research/THEORETICAL-FOUNDATION.md`](docs/research/THEORETICAL-FOUNDATION.md) | Official scientific basis |
| [`docs/STATUS.md`](docs/STATUS.md) | Live progress dashboard |
| [`planning/`](planning/) | Master plan, architecture, data model, all decisions |

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| F0 | Safety net: CI, branch protection, fleet infra | ✅ done |
| F1 | Foundations: scaffold, contracts, physics, app skeletons | 🟡 in progress |
| F2 | Migration of the v5 historical data into v6 | ⏳ |
| F3 | Public landing + live demo | ⏳ |
| F4+ | Ecosystem (sharing, notifications, networks), AI, admin console | ⏳ |

---

## Author & acknowledgments

Created and led by **Alexander Kholodov** (undergraduate researcher, USFQ), under the supervision
of **Dennis Cazar**, in the **LEOPARD** laboratory at Universidad San Francisco de Quito, within
the **EL-BONGO / Erasmus+ CBHE** project. Detector firmware: **MuNRa** (CosmicWatch-derived).

---

## License & citation

- **Code:** [MIT](LICENSE).
- **Data:** CC-BY 4.0 (open science with attribution).
- A `CITATION.cff` and a Zenodo DOI will accompany the first tagged release.

---

## Version history

| Version | Description |
|---|---|
| 1.0 | Python desktop app with local SQLite |
| 2.0 | Migration to a web platform with Firebase |
| 3.0–3.2 | Role-based access, sessions, admin panel |
| 4.0–4.8 | Web Serial API, modular JS, i18n, LTTB downsampling, sharing |
| 5.0 | Full rewrite as MunHub (vanilla JS); bandwidth-optimized Firebase, WebSocket bridge, terminal, migration tools |
| **6.0 (in progress)** | **Ground-up reconstruction: typed monorepo, provider-agnostic data layer, installable agent, scientific foundation, design system, agent-fleet development** |

---

## External resources

- [MuNRa detector documentation](https://gitmilab.redclara.net/muografia/escaramujo/munra_como_usar/-/tree/main?ref_type=heads)
- [Firebase documentation](https://firebase.google.com/docs)
- [Web Serial API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [NMDB — Neutron Monitor Database](https://www.nmdb.eu/)
