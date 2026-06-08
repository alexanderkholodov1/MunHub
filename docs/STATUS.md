# MunHub Lab v6.0 — Status dashboard

> Living quality/progress board, updated by the orchestrator at the close of each wave.
> Source of truth for "where are we" across the agent fleet. See
> `planning/18-AGENT-FLEET-ORCHESTRATION.md` for the system that produces these numbers.

_Last updated: 2026-06-07 (Phase 0 — fleet bootstrap)_

## Phase progress
| Phase | Scope | Status |
|---|---|---|
| **F0** | Safety net: CI, branch protection, fleet infra | ✅ done (PR #19 merged) |
| **F1** | Foundations: scaffold, contracts, physics, web/agent skeleton | 🟡 started (S01 ✅; S03/S06 next) |
| **Design** | Design Language "Observatory Dark" (D36) → feeds all UI specs | 🟡 PR open (this) |
| F2 | Migration munra-1 → munhub-1 | ⏳ |
| F3 | Public landing + live demo | ⏳ |
| F4+ | Ecosystem, AI, networks, admin… | ⏳ |

## Spec coverage
| Spec | Title | Agent | Status | PR |
|---|---|---|---|---|
| S01 | Monorepo scaffold | Claude | ✅ merged | (on main) |
| S02 | CI quality gate | Claude | 🟡 PR open (this wave) | — |
| S03 | Shared types + zod contracts | Claude | ⏳ next | — |
| S06 | Physics corrections | Gemini | ⏳ next | — |

> Full backlog: `planning/04-BACKLOG.md` (S01–S73).

## Quality gates (defense-in-depth — planning/18 §6)
| Gate | Mechanism | State |
|---|---|---|
| CI: build/test/lint/typecheck | GitHub Actions `ci.yml` | ✅ active (green on PR #19) |
| Secret scan | gitleaks | ✅ active (green on PR #19) |
| `main` protection | PR + both CI checks required; no force-push/delete | ✅ active |
| Coverage hard-gate (≥80%) | vitest coverage | ⏳ activates at S06 |
| Auto PR review #1 | Cursor Bugbot | ⏳ enable in Cursor dashboard |
| Auto PR review #2 | Copilot review | ⏳ enable on repo |
| Cross-provider review | author ≠ reviewer (D35) | ⏳ from F1 wave 1 |

## MVP end-to-end checklist (AGENTS.md vertical slice)
- [ ] Auth: user signs in
- [ ] Station + Detector created
- [ ] Agent reads serial + local SQLite backup
- [ ] Data persisted via DataProvider (munhub-1)
- [ ] Dashboard shows live dead-time + barometric-corrected rate
- [ ] Amplitude (Landau) spectrum renders

## Fleet roster (live)
| Provider | Role | Ready |
|---|---|---|
| Claude Opus | Orchestrator / architect / reviewer | ✅ |
| Claude Sonnet / Haiku | Implementer / mechanical | ✅ |
| Gemini CLI | Volume implementer / docs | ✅ |
| Cursor Pro (1 mo) | BG agents + Bugbot + IDE | 🟡 enable Bugbot |
| Copilot (Education) | Coding agent + review | ✅ (gh authed) |
