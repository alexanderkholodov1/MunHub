# Adapter — Claude Code (Anthropic)

> **Last verified:** 2026-06-12 (first adopter's landscape audit). Re-verify quarterly
> (doctrine 3) — surfaces and billing move.

## Where it runs

| Surface | Use for |
|---|---|
| **Web/cloud sessions** (claude.ai/code) | implementer/worker WPs — the default execution surface (doctrine 1) |
| **Routines** (scheduled cloud agents) | recurring jobs: PR babysitting, scheduled audits, dependency bumps |
| **`anthropics/claude-code-action`** (GitHub Actions) | in-repo automation: respond to issues/PR comments, CI-triggered fixes |
| **Local CLI / desktop app** | the ONE interactive session — the operator's adjutant. Never fan out locally |
| **Subagents** (Agent tool inside a session) | read-only exploration/review fan-out inside the adjutant session |

## How to start a task

- **Cloud session:** open a session on the repo, paste the work package text (and only it —
  context economy), let it branch/commit/push/PR.
- **Routine:** define the schedule + prompt; treat each run as a wave that must end with a
  PR or a status update.
- **Action:** install the GitHub App, add the workflow from the action's docs; tasks arrive
  as `@claude` mentions on issues/PRs.

## Shim wiring

Reads `CLAUDE.md` at the repo root automatically (plus `.claude/` for settings, agents,
skills, hooks). Instantiate `templates/shims/CLAUDE.template.md`; reviewer personas from
`personas/` can be installed as `.claude/agents/*.md`.

## Strengths / routing

Frontier reasoning: contract design, architecture, review personas, orchestration
(adjutant). Mid tiers (Sonnet/Haiku) handle implementer and mechanical WPs — route by
strength (doctrine 7).

## Cost / billing cautions

Subscription seats (Pro/Max) cover interactive + cloud session usage within limits; API
billing applies to the GitHub Action (token-metered) and Agent-SDK automation. Watch
Routines frequency — a too-eager schedule burns quota on no-op runs.
