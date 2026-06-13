# Wave plan — <milestone name>

> Output of `playbooks/compose-fleet.md`. The maintainer reviews and approves THIS before any
> execution. Fill every section; an empty section means the composition isn't ready.

## 1. Objective (the macro goal, one paragraph)
<What "done" means for this milestone, in product/engineering terms. One PR will deliver it.>

## 2. Live roster (probed now, not assumed)
| Provider | Status | Evidence |
|---|---|---|
| Gemini CLI | UP / DOWN | <CLI reply / error> |
| Cursor API | UP / DOWN | <HTTP 200 / code> |
| GitHub | UP / DOWN | <HTTP 200> |
| Vercel | UP / DOWN | <HTTP 200> |
| Claude subagents | UP | in-harness |
| Copilot | review-only | Education plan |

> DOWN providers are excluded from this plan and their lanes re-routed (note the substitution).

## 3. Task tier & rationale
**Tier:** trivial / bounded / large / huge — <why: coherence surface, risk, interdependence>

## 4. Composed tree (who supervises whom, who executes what)
```
Adjutant (<model>) — macro review + the single PR
├─ Squad-lead A (<model>) — <area>, checks partial consistency
│   ├─ Executor (<provider>) — <acotada task> — lane: <files/globs>
│   └─ Executor (<provider>) — <acotada task> — lane: <files/globs>
└─ Specialist (<model>) — <research/other, outside squads>
Reviewer (<provider ≠ author>) — cross-provider check before PR
```

## 5. Quota & time estimate
| Role / provider | Tier | Est. tokens/quota | Est. wall-clock |
|---|---|---|---|
| ... | frontier / cheap / free | ... | ... |
**Total frontier (paid) estimate:** <the number the maintainer is approving>

## 6. Disjoint-lane manifest (feeds the preflight gate)
Path to the `wave-preflight` manifest JSON, or inline the lanes. Must pass before launch.

## 7. Approval
- [ ] Maintainer approves this tree and the quota estimate.
> Escalation: trivial+free auto-proceeds on preflight; frontier/paid, large/huge, or
> production-touching always needs this checkbox.
