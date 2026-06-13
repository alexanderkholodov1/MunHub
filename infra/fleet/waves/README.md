# Wave manifests

A wave manifest declares the work packages of one fleet fan-out and feeds the **mandatory**
preflight gate (`infra/fleet/wave-preflight.ps1`). No wave launches until the gate exits 0.

```
pwsh infra/fleet/wave-preflight.ps1 -Wave infra/fleet/waves/<name>.json [-MaxIndependentPRs 8]
```

## Format

```json
{
  "dependsOnUnmergedPRs": false,
  "workPackages": [
    { "id": "WP-id", "executor": "gemini|cursor|copilot|claude", "paths": ["glob", "..."] }
  ]
}
```

- **`dependsOnUnmergedPRs`** — `true` blocks the wave (contracts-first: never fan out on an
  unmerged foundation).
- **`executor`** — routes the WP. `gemini` = mechanical bulk (cheap tier). `cursor` = UI/cloud
  via the Bearer API. `copilot` = review-only on the Education plan (not an executor). `claude`
  = research/architecture only — never mechanical bulk.
- **`paths`** — every file/glob the WP may touch. The gate resolves these against the index and
  **fails** if two WPs intersect or if any WP touches an orchestrator-owned high-contention file
  (STATUS, AGENTS, shared contracts, planning indexes, changelog).

`EXAMPLE.json` is a passing template (two disjoint Gemini translation batches).

## Why this exists

In wave F1-W4 two parallel workers both edited `docs/research/THEORETICAL-FOUNDATION.md` — a
collision that cost rework and risked silently reverting a science correction. The playbook
already forbade it; the failure was that a *text* playbook can be skipped. This gate makes the
checklist executable so the same mistake cannot reach launch. See the AFLEK
`playbooks/run-a-wave.md`.
