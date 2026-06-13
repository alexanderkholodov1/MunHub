# Incident log — fleet self-hardening

> When something goes wrong — a merge conflict, a skipped gate, a partial delivery passed off as
> done, a provider that went down, a conflict between executors or between squad-leads — the
> orchestrator records it HERE and ships the hardening that prevents a recurrence. **An incident
> the maintainer had to point out is itself an incident** (the system should have caught it).
>
> This is not blame; it is the learning loop. Each entry ends in a concrete change to a gate,
> a doctrine line, the registry, or a template — never just "be more careful next time."

## Entry format

```
## YYYY-MM-DD — <short title>
- What happened: <the failure, factually>
- How it surfaced: <self-caught | maintainer pointed it out | CI | a worker report>
- Root cause: <the real cause — usually a missing gate or a skipped step, not the agent>
- Hardening shipped: <the concrete change + where (gate/doctrine/registry/template), with a ref>
- Recurrence now blocked by: <the mechanism that makes this structurally impossible>
```

---

## 2026-06-12 — Two lanes edited one shared file (fan-out collision)
- What happened: a translation worker and a science-correction worker both edited
  `docs/research/THEORETICAL-FOUNDATION.md`; merge conflict + risk of silently reverting the fix.
- How it surfaced: self-caught at wave close (diffing the two PRs' file lists) — but only because
  the maintainer had already flagged the broader process breakdown.
- Root cause: the orchestrator fanned out without running the run-a-wave checklist; a *text*
  checklist is skippable under load.
- Hardening shipped: executable `wave-preflight.ps1` (fails on intersecting lanes and on any WP
  touching a high-contention file) + `compose-fleet.md` step 0 making it mandatory.
- Recurrence now blocked by: the preflight gate exits non-zero before launch.

## 2026-06-12 — Milestone delivered as 5 fragmented PRs
- What happened: translating `planning/` shipped as 5 separate PRs instead of one, 5×-ing review
  load and risking cross-file incoherence.
- How it surfaced: maintainer pointed it out.
- Root cause: workers opened their own PRs; there was no squad-lead consolidating to one branch,
  and no "one milestone = one PR" rule.
- Hardening shipped: the squad-lead → Adjutant → one-PR flow (`compose-fleet.md` step 8); workers
  file `worker-report.template.md` instead of opening PRs.
- Recurrence now blocked by: doctrine + the report template; an executor opening a PR is now an
  out-of-process action a reviewer rejects.

## 2026-06-12 — A high-contention file (STATUS) carried in two PRs
- What happened: `docs/STATUS.md` was edited in both the physics PR and a standalone status PR,
  which then went CONFLICTING/stale.
- How it surfaced: maintainer asked about the conflicting PR.
- Root cause: STATUS (orchestrator-owned) was treated as ordinary lane content.
- Hardening shipped: STATUS/AGENTS/contracts/changelog are flagged high-contention in the
  preflight gate; the board is refreshed only as part of a milestone's single PR, never alone.
- Recurrence now blocked by: the gate fails any WP touching a high-contention path.
