# MunHub Lab v6.0 — Status dashboard

> Living quality/progress board, updated by the orchestrator at the close of each wave.
> Source of truth for "where are we" across the agent fleet. See
> `planning/18-AGENT-FLEET-ORCHESTRATION.md` for the system that produces these numbers.

_Last updated: 2026-06-13 (audit merged #26; **fleet kit v0.1 adopted** — `FLEET-VERSION` 0.1.0,
incubation folder removed; kit lives at `alexanderkholodov1/fleet`)_

## Phase progress
| Phase | Scope | Status |
|---|---|---|
| **F0** | Safety net: CI, branch protection, fleet infra | ✅ done (PR #19 merged) |
| **F1** | Foundations: scaffold, contracts, physics, web/agent skeleton | 🟡 in progress (S01 ✅; contracts ✅ #24; DataProvider interface ✅ #25; **physics spec next**) |
| **Design** | Design Language "Observatory Dark" (D36) → feeds all UI specs | ✅ merged (PR #20); landing design session pending |
| **Docs** | README v6, technical docs, standards, fleet charter | ✅ merged (PRs #21–#23) |
| **Audit** | Project audit + English agent entry points + reconstruction work packages | ✅ merged (PR #26; see `docs/audit/2026-06-12-STATE-OF-PROJECT.md`) |
| **Fleet** | Fleet kit extraction (WP-10/FWP-01…09) + MunHub adoption (FWP-08) | ✅ kit v0.1 built at `alexanderkholodov1/fleet`; adoption = this PR |
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
| `specs/0005-physics` (to write) | dead-time, β regression, spectrum | Adjutant writes spec → implementer | ⏳ **next on the critical path** | — |

> ⚠️ **Numbering note:** the S-numbers in `planning/04-BACKLOG.md` and GitHub issues #3–#18 have
> diverged from the canonical `specs/NNNN-*` folders (e.g. backlog "S04 physics" vs folder
> `specs/0004-data-provider-interface`). The `specs/NNNN-*` folders are canonical; renumbering
> the backlog and issues is queued as WP-03 in the audit report.

## Quality gates (defense-in-depth — planning/18 §6)
| Gate | Mechanism | State |
|---|---|---|
| CI: build/test/lint/typecheck | GitHub Actions `ci.yml` | ✅ active |
| Secret scan | gitleaks | ✅ active |
| `main` protection | PR + both CI checks required; no force-push/delete | ✅ active |
| Coverage hard-gate (≥80%) | vitest coverage | ⏳ activates with the physics spec |
| Auto PR review #1 | Copilot review | ⏳ enable on repo (free on Education plan) |
| Auto PR review #2 | Claude reviewer personas (WP-08) | ⏳ replaces Cursor Bugbot — deferred over usage-billing risk |
| Cross-provider review | author ≠ reviewer (D35) | ⏳ from F1 wave 2 |

## MVP end-to-end checklist (AGENTS.md vertical slice)
- [ ] Auth: user signs in
- [ ] Station + Detector created
- [ ] Agent reads serial + local SQLite backup
- [ ] Data persisted via DataProvider (munhub-1)
- [ ] Dashboard shows live dead-time + barometric-corrected rate
- [ ] Amplitude (Landau) spectrum renders

## Fleet roster (current doctrine: cloud-first — see audit WP-07)
| Provider | Role | Notes |
|---|---|---|
| Claude (Adjutant session) | Orchestrator / architect / reviewer | cloud sessions preferred over local fan-out |
| Claude Sonnet / Haiku | Implementers (cloud subagents / web sessions) | |
| Cursor Cloud Agents + Bugbot | Parallel UI waves + PR review | Pro window expires ~early July — front-load |
| Gemini CLI | Volume implementation / docs / translation | free tier; run in cloud or off-hours |
| Copilot (Education) | Issue → PR agent + second auto-review | |

## Maintainer action queue
1. In the fleet repo: merge PRs #5 → #6 → #7, then the orchestrator tags `v0.1.0` (FWP-09).
2. Merge this adoption PR (FWP-08).
3. Decide ADR-002 (Tauri vs Go for the local agent) — recommendation: Tauri.
4. Enable **Copilot code review** on the repo (free on Education). Cursor **Bugbot stays off**
   (usage-billed); Claude reviewer personas (WP-08) take its slot in the review ensemble.
5. See `docs/audit/2026-06-12-STATE-OF-PROJECT.md` §Decisions for the full decision queue.
