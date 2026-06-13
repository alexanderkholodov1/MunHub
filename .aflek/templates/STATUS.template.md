# {{PROJECT}} — Status dashboard   *(AFLEK template — install as `docs/STATUS.md`)*

<!--
  TEMPLATE PLACEHOLDERS — replace all {{…}} and delete this comment block.
  {{PROJECT}}        product name
  {{PHASES}}         the project's phase plan rows
  {{ORCH_DOC}}       where the orchestration system is documented (optional — delete the line)

  RULES (doctrine 6 — no chat-dependent state):
  - Orchestrator-owned: updated at the close of EVERY wave; feature PRs coordinate rather than
    edit it in parallel.
  - Always carry a dated "_Last updated_" line. A stale board is a defect, not a cosmetic issue.
  - The "Maintainer action queue" is the ONE place the human looks to know what is blocked on
    them. Keep it ordered and short.
-->

> Living quality/progress board, updated by the orchestrator at the close of each wave.
> Source of truth for "where are we" across the agent fleet. See {{ORCH_DOC}}.

_Last updated: YYYY-MM-DD (wave …)_

## Maintainer action queue

1. <!-- ordered: merges to perform, decisions to take, one-click chores -->

## Phase progress

| Phase | Scope | Status |
|---|---|---|
| {{PHASES}} | | |

## Specs / work packages in flight

| Spec | Title | Executor | Status | PR |
|---|---|---|---|---|
| | | | ⏳ / 🟡 PR open / ✅ merged | |

## Quality gates (defense-in-depth)

| Gate | Mechanism | State |
|---|---|---|
| CI: build/test/lint/typecheck | e.g. GitHub Actions | |
| Secret scan | e.g. gitleaks | |
| `main` protection | PR + required checks; no force-push/delete | |
| Coverage gate | | |
| Automated reviewer #1 | | |
| Automated reviewer #2 (different provider — doctrine 7) | | |

## Fleet roster (live)

| Provider / surface | Role | Ready |
|---|---|---|
| | orchestrator / implementer / reviewer / mechanical | |
