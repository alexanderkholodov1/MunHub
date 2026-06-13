# MunHub Lab v6.0 — Status dashboard

> Living quality/progress board, updated by the orchestrator at the close of each wave.
> Source of truth for "where are we" across the agent fleet. The system that produces these
> numbers is the AFLEK kit (pinned in `FLEET-VERSION`).

_Last updated: 2026-06-12 (wave F1-W4: physics ✅ in PR #31; WP-01 olas 1–5 in PRs
#30,33,35,37,39; WP-03 in PR #29; WP-04 science correction folded into PR #39 (#36 closed);
WP-06 ADR-002 in PR #32; spec Insights v0 in PR #34)_

## Phase progress

| Phase | Scope | Status |
|---|---|---|
| **F0** | Safety net: CI, branch protection, fleet infra | ✅ done (PR #19 merged) |
| **F1** | Foundations: scaffold, contracts, physics, web/agent skeleton | 🟡 in progress (scaffold ✅; contracts ✅ #24; DataProvider ✅ #25; **physics ✅ in PR #31**; FirebaseProvider spec next) |
| **Design** | Design Language "Observatory Dark" (D36) → feeds all UI specs | ✅ merged (PR #20); landing design session pending |
| **Docs** | README v6, technical docs, standards, fleet charter | ✅ merged (PRs #21–#23) |
| **Audit** | Project audit + English agent entry points + reconstruction work packages | ✅ merged (PR #26; see `docs/audit/2026-06-12-STATE-OF-PROJECT.md`) |
| **Fleet** | Fleet kit v0.1 adoption (FWP-08) | ✅ merged (PR #28); kit at `alexanderkholodov1/AFLEK` |
| **Translation** | WP-01: planning/ + THEORETICAL-FOUNDATION → English | ✅ olas 1–5 in PRs #30,33,35,37,39 (full `planning/` tree + foundation translated) |
| F2 | Migration munra-1 → munhub-1 | ⏳ |
| F3 | Public landing + live demo | ⏳ |
| F4+ | Ecosystem, AI, networks, admin… | ⏳ |

## Specs in flight

| Spec folder | Title | Implementer | Status | PR |
|---|---|---|---|---|
| `specs/0001-monorepo-scaffold` | Monorepo scaffold | Claude | ✅ merged | on `main` |
| `specs/0002-ci-cd` | CI quality gate | Claude | ✅ merged | PR #19 |
| `specs/0003-shared-contracts` | Shared types + zod contracts | Claude | ✅ merged | PR #24 |
| `specs/0004-data-provider-interface` | DataProvider interface | Claude | ✅ merged | PR #25 |
| `specs/0005-physics` | Dead-time, β regression, spectrum, Poisson stats | Adjutant | 🔍 in review | PR #31 |
| `specs/0006-insights-v0` | Corrected rate + statistical baseline (F3) | Adjutant (spec) | 🔍 in review | PR #34 |

> **Numbering:** `specs/NNNN-*` folders are canonical. Backlog renumbering (WP-03) in PR #29.
> GitHub issues #3–#18 still carry old numbers until WP-02 re-issues them.

## Active PR queue

| PR | Branch | Contents | CI |
|----|--------|----------|----|
| [#29](https://github.com/alexanderkholodov1/MunHub/pull/29) | `docs/wp03-spec-numbering` | WP-03: backlog → canonical NNNN numbers | ✅ |
| [#30](https://github.com/alexanderkholodov1/MunHub/pull/30) | `docs/wp01-translation-wave1` | WP-01 ola 1: planning/01–03,05,06 | ✅ |
| [#31](https://github.com/alexanderkholodov1/MunHub/pull/31) | `spec/0005-physics` | **`@munhub/physics` — critical F1** | ✅ |
| [#32](https://github.com/alexanderkholodov1/MunHub/pull/32) | `docs/wp06-close-adr-002` | WP-06: ADR-002 accepted (Tauri) | ✅ |
| [#33](https://github.com/alexanderkholodov1/MunHub/pull/33) | `docs/wp01-translation-wave2` | WP-01 ola 2: planning/07–10, RED-CLARA | ✅ |
| [#34](https://github.com/alexanderkholodov1/MunHub/pull/34) | `spec/insights-v0-wp09` | WP-09: spec Insights v0 (F3) | ✅ |
| [#35](https://github.com/alexanderkholodov1/MunHub/pull/35) | `docs/wp01-translation-wave3` | WP-01 ola 3: planning/11–15 | ✅ |
| [#37](https://github.com/alexanderkholodov1/MunHub/pull/37) | `docs/wp01-translation-wave4` | WP-01 ola 4: planning/16–17,19 | ✅ |
| [#39](https://github.com/alexanderkholodov1/MunHub/pull/39) | `docs/wp01-translation-wave5` | WP-01 ola 5: planning/00 + foundation → English **+ WP-04 cutoff-rigidity correction folded in** | 🔄 |

> **PR #36 (WP-04) closed** — its science correction (cutoff rigidity ≈12–13 GV + §13 citations)
> was folded into #39 in English to avoid a same-file collision on `THEORETICAL-FOUNDATION.md`
> that risked reverting the fix. #39 is the single source of truth for that file.

## Quality gates (defense-in-depth — AFLEK doctrine 7)

| Gate | Mechanism | State |
|---|---|---|
| CI: build/test/lint/typecheck | GitHub Actions `ci.yml` | ✅ active |
| Secret scan | gitleaks | ✅ active |
| `main` protection | PR + both CI checks required; no force-push/delete | ✅ active |
| Coverage hard-gate (≥80%) | vitest coverage (`@munhub/physics`) | 🔍 active — in PR #31 |
| Auto PR review #1 | Copilot review | ⏳ enable on repo (free on Education plan) |
| Auto PR review #2 | Claude reviewer personas (`.claude/agents/`) | ✅ installed (WP-08) |
| Cross-provider review | author ≠ reviewer (D35) | ⏳ from F1 wave 2 |

## MVP end-to-end checklist (AGENTS.md vertical slice)

- [ ] Auth: user signs in
- [ ] Station + Detector created
- [ ] Agent reads serial + local SQLite backup
- [ ] Data persisted via DataProvider (munhub-1)
- [ ] Dashboard shows live dead-time + barometric-corrected rate
- [ ] Amplitude (Landau) spectrum renders

## Fleet roster (current doctrine: cloud-first)

| Provider | Role | Notes |
|---|---|---|
| Claude (Adjutant session) | Orchestrator / architect / reviewer | This session |
| Claude Sonnet/Haiku subagents | Translators, WP workers | PRs #29–#37 |
| Cursor Cloud Agents | Parallel UI waves | Pro window ~early July — front-load |
| Copilot (Education) | Second auto-review | Enable on repo settings |

## Maintainer action queue

> All PRs below have CI green and are ready to merge.

1. **Merge [#31](https://github.com/alexanderkholodov1/MunHub/pull/31)** — `@munhub/physics` (critical F1 path; unlocks FirebaseProvider spec).
2. **Merge [#29](https://github.com/alexanderkholodov1/MunHub/pull/29)** — backlog renumbering (independent).
3. **Merge [#30](https://github.com/alexanderkholodov1/MunHub/pull/30), [#33](https://github.com/alexanderkholodov1/MunHub/pull/33), [#35](https://github.com/alexanderkholodov1/MunHub/pull/35), [#37](https://github.com/alexanderkholodov1/MunHub/pull/37)** — translation olas 1–4 (any order, independent).
4. **Merge [#32](https://github.com/alexanderkholodov1/MunHub/pull/32)** — ADR-002 accepted (Tauri confirmed).
5. **Merge [#39](https://github.com/alexanderkholodov1/MunHub/pull/39)** — translation ola 5 + science correction (⚠️ see note below). Merge **after** olas 1–4 to keep the `planning/` history clean.
6. **Merge [#34](https://github.com/alexanderkholodov1/MunHub/pull/34)** — spec Insights v0 (spec-only, safe anytime).
7. **Enable Copilot code review** on the repo settings (free on Education plan) — 1-click chore.
8. **Confirm Q4:** approve "Insights" + "Events" as the ML surface names so Insights v0 implementation can proceed.

> ⚠️ **PR #39 note — science correction:** the Quito/Ecuador geomagnetic cutoff rigidity has
> been corrected from "14–16.8 GV (highest on the planet)" to **≈12–13 GV (among the highest
> on Earth)**. Research finding: the ~14–17 GV range appears in some older sources but IGRF-based
> trajectory calculations place Quito at ≈12–13 GV (geomagnetic latitude ~10–15°; the South
> Atlantic Anomaly weakens the local field). The global maximum ≈17 GV is at Doi Inthanon,
> Thailand. The scientific argument for Ecuador remains fully valid — ≈12–13 GV is still
> exceptionally high. Please review the change before merging; if you have a primary source that
> supports the higher value, flag it and we will reconcile.
