# Adapter — Gemini CLI (Google)

> **Last verified:** 2026-06-12 (first adopter's landscape audit). Re-verify quarterly
> (doctrine 3).

## Where it runs

| Surface | Use for |
|---|---|
| **Gemini CLI** (local, single session) | volume implementer / docs / translation WPs run interactively or scripted one-at-a-time |
| **GitHub Actions wrapper** | cloud execution of the CLI in a workflow if a hands-off surface is needed |

Gemini has no first-party "cloud agent fleet" surface equivalent to Claude web sessions or
Cursor Cloud Agents; treat the CLI as a worker you invoke for one WP at a time. Doctrine 1
still applies: do not run it in parallel with other local agents on the operator's machine.

## How to start a task

Run the CLI in the repo worktree with the work package text as the prompt. The session
must end with branch + commit + push + PR like every other worker (the operator's adjutant
can drive it, or a wrapper script can).

## Shim wiring

Reads `GEMINI.md` at the repo root. Instantiate `templates/shims/GEMINI.template.md` —
keep the guardrail digest current with `AGENTS.md` (doctrine 5).

## Strengths / routing

High-volume, low-risk work: documentation, translations, mechanical refactors, test
scaffolding — the cheap-tier lane of doctrine 7. Also useful as a *different-provider
reviewer* for Claude-authored PRs.

## Cost / billing cautions

Generous free tier (personal Google account) with daily request caps — fine for docs/bulk
lanes. Hitting the cap mid-WP stalls the wave: split large WPs (e.g. translation in ≤5-file
batches). Paid API keys remove caps but are token-metered — set quotas before pointing it
at a big corpus.
