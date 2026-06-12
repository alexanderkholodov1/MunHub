# MunHub Lab — Architecture (technical overview)

> Public, English distillation of [`planning/01-ARCHITECTURE.md`](../../planning/01-ARCHITECTURE.md)
> and the AFLEK kit (<https://github.com/alexanderkholodov1/AFLEK>, pinned in `FLEET-VERSION`).
> Status: pre-alpha — describes the target design and what already exists.

## 0. C4 view (Context + Container)

```mermaid
flowchart TB
    researcher([Researcher / student]):::person
    detector([Cosmic-ray detector<br/>USB, MuNRa firmware]):::person
    ext([Space-weather APIs<br/>NMDB · NOAA · NASA]):::ext

    subgraph MunHub[MunHub Lab platform]
        agent[Agent · Tauri<br/>serial read + SQLite + sync]:::box
        web[Web · Next.js<br/>landing · dashboards · admin]:::box
        dp[data-provider<br/>backend-agnostic interface]:::box
        core[shared + physics<br/>contracts + pure science]:::box
        db[(Data backend<br/>Firebase → Supabase)]:::db
        ai[AI/ML service<br/>anomaly · Forbush · β]:::box
    end

    detector -->|serial| agent
    agent -->|push records| dp
    researcher -->|views| web
    web --> dp
    dp --> db
    agent -. uses .-> core
    web -. uses .-> core
    ai --> dp
    ext -->|correlation| ai

    classDef person fill:#1A2030,stroke:#4CC9F0,color:#E6EAF2;
    classDef ext fill:#1A2030,stroke:#F5B544,color:#E6EAF2;
    classDef box fill:#131722,stroke:#252C3B,color:#E6EAF2;
    classDef db fill:#131722,stroke:#5BD6A0,color:#E6EAF2;
```

- **Level 1 (Context):** researchers and detectors interact with MunHub; MunHub pulls space-weather
  data for correlation.
- **Level 2 (Container):** the agent, web app, data-provider, pure core, data backend, and AI
  service. **Level 3 (Component)** is documented per package as each is built.

## 1. Principles

1. **Provider-agnostic data.** The app never talks to Firebase/Supabase directly; everything goes
   through `packages/data-provider`. Changing backend = changing one implementation.
2. **Offline-first at the edge.** The local agent persists data (SQLite) before syncing; the
   detector never loses data on network or power loss.
3. **Scientific integrity by contract.** Invariants — *averages never sums*, *no event filtering* —
   are enforced by `zod` schemas in `packages/shared`, not by convention.
4. **One source of truth for types.** Models, schema, and constants live in `packages/shared` and
   are consumed by web, agent, api, and ai.
5. **Security by default.** Deny-by-default rules; secrets never in the repo; data redundancy is a
   requirement, not an option.
6. **Edge processing.** Heavy work (per-minute averaging, feature extraction, validation) happens
   on the detector's PC (the agent), keeping the server/bandwidth light. This is what lets the
   platform run indefinitely on a free cloud tier.

## 2. Components

```
packages/shared          TypeScript types, zod schemas, constants, i18n keys, pure utilities
packages/physics         Pure science: dead-time & barometric correction, flux, Landau spectrum
packages/data-provider   DataProvider interface + FirebaseProvider (Phase A) + SupabaseProvider (Phase B)
packages/ui              Design system (Tailwind + shadcn/ui + Plotly) — "Observatory Dark"

apps/web (Next.js)       Public landing, dashboards (station/admin), external-correlation pages
apps/agent (Tauri)       Cross-platform serial reading + local SQLite + offline sync queue

services/api             (Phase B) backend / edge functions: ingest, aggregations, jobs
services/ai              (Phase B) ML pipeline (anomaly detection, Forbush, barometric β)
```

**Allowed dependencies:** `web`, `agent`, `api`, `ai` may depend on `shared`, `data-provider`,
`physics`; `web` also on `ui`. `shared` and `physics` depend on **nothing with I/O** (pure,
independently testable). `data-provider` depends only on `shared`.

## 3. The data-provider layer (keystone)

A single `DataProvider` interface (defined in `packages/data-provider`, spec S04) exposes auth,
institutions, stations, detectors, sessions, time-series reads/writes, and realtime subscriptions.
The app consumes it without knowing the backend. **This same interface is the engine of the admin
migration tool** — `exportAll` streams `DataChunk`s out of one provider and `importAll` ingests them
into another — which is how the v5 → v6 and Phase A → Phase B migrations work.

## 4. Data flow

```
[detector] → agent (read serial → validate → per-minute average → SQLite backup → sync queue)
           → DataProvider.pushMinuteRecord / pushRealtimeRecord
           → Firebase Realtime Database (munhub-1)
           → DataProvider.subscribeRealtime / getMinuteRecords
           → web dashboard (corrections applied via packages/physics, charts via Plotly)
```

The corrections pipeline (mandatory order): **raw → dead-time → barometric (local β) → thermal**.
See [`DATA-MODEL.md`](DATA-MODEL.md) and the scientific foundation.

## 5. Ingestion paths

- **Agent (standard):** the installable Tauri agent is the single standard ingestion path — runs in
  the background, survives reboots, backs up locally, syncs when online.
- **Web Serial (demo only):** an optional browser path (Chrome/Edge) for quick demos, with an
  explicit "data is not saved offline" warning.

## 6. Deployment phases

- **Phase A (now):** Next.js **static export** on Firebase Hosting (free tier; blocks rather than
  charges on overage), data via Firebase (Realtime DB, Auth, Storage). Fully self-sufficient.
- **Phase B (optional upgrade):** self-hosted Supabase + TimescaleDB (e.g., on a Red Clara server),
  full SSR. Reached by swapping the provider implementation — the app does not change.

## 7. Quality gates (defense-in-depth)

Every pull request runs CI (build · test · lint · typecheck) plus a secret scan; `main` is
protected and only the maintainer merges. Physics/contracts/security changes get specialized
review. Coverage becomes a hard gate once production code lands. See
the AFLEK kit (doctrine rule 7).
