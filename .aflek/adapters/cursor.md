# Adapter — Cursor

> **Last verified:** 2026-06-12 (first adopter's landscape audit). Re-verify quarterly
> (doctrine 3).

## Where it runs

| Surface | Use for |
|---|---|
| **Cloud Agents** (cursor.com dashboard / IDE) | implementer WPs in the cloud — the doctrine-1 surface |
| **IDE (local)** | the operator's own editing; not an agent execution surface for AFLEK |
| **Bugbot** (PR review bot) | automated PR review — see billing caution |

## How to start a task

**Cloud Agent via the REST API (the AFLEK way — no manual app interaction).** The orchestrator
launches and monitors Cursor Cloud Agents programmatically against `https://api.cursor.com`:

- **Auth: Bearer, not Basic.** `Authorization: Bearer $CURSOR_API_KEY`. (HTTP Basic returns
  `401 Invalid User API Key` — a wiring bug that masked the API as "unavailable"; verified
  2026-06-12 the same key works on Bearer with HTTP 200.)
- `GET /v0/agents` lists agents; `POST /v0/agents` launches one with the work-package text and
  the target repo; one spec per branch/PR. The agent commits to a branch and opens the PR itself.
- Poll `GET /v0/agents/{id}` for status and surface it on the status board.

The dashboard/IDE stay available for the operator's own editing, but **fleet dispatch goes through
the API** so every executor obeys the same orchestration surface — no agent runs "off to the side."

## Shim wiring

Reads `.cursor/rules/*.mdc`. Instantiate `templates/shims/cursor-rules.template.mdc` as
`.cursor/rules/00-agents.mdc` with `alwaysApply: true` — Cloud Agents and the IDE both
load it.

## Strengths / routing

Strong at UI/front-end lanes and iterative in-editor work. Route UI work packages here;
keep contracts and physics-grade logic with the frontier lane (doctrine 7).

## Cost / billing cautions

- Cloud Agents consume the plan's usage allowance; monitor the dashboard during heavy waves.
- **Bugbot is usage-billed separately** — the first adopter turned it OFF (2026-06-12) and
  replaced it in the review ensemble with Copilot review + Claude personas. If you enable
  Bugbot, set a spending cap first.
- Plan limits reset monthly; a stalled agent retrying in a loop can quietly drain a month's
  allowance — kill stuck agents from the dashboard.
