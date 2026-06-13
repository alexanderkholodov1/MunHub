# Adapter — GitHub Copilot

> **Last verified:** 2026-06-12 (first adopter's landscape audit). Re-verify quarterly
> (doctrine 3).

## Where it runs

| Surface | Use for |
|---|---|
| **Coding agent (Issue → PR)** | well-specified implementer WPs: assign an Issue to Copilot, it works in a cloud sandbox and opens a PR |
| **Code review** | the second automated reviewer in the ensemble (doctrine 7) — enable in repo settings |
| **IDE completion/chat** | the operator's own editing; not a fleet surface |

## How to start a task

1. Create a GitHub Issue containing the work package (the WP text IS the issue body —
   goal, files, constraints, acceptance criteria, docs to update).
2. Assign the issue to Copilot. It plans, implements in an Actions-backed sandbox, and
   opens a draft PR referencing the issue.
3. Review comments on the PR ("@copilot …") send it back to work.

The Issue→PR flow makes Copilot the cleanest fit for the kit's WP format: the issue
template and the WP template are the same document.

## Shim wiring

Reads `.github/copilot-instructions.md`. Instantiate
`templates/shims/copilot-instructions.template.md`. The coding agent also respects
`AGENTS.md` — keep both aligned (doctrine 5).

## Strengths / routing

Mid-tier implementer for mechanically-checkable WPs; PR review as the cross-provider
second reviewer. Education/Pro plans make it the cheapest cloud implementer seat.

## Cost / billing cautions

Coding-agent sessions consume premium requests (and Actions minutes). Free/Education
allowances are real but finite — batch small WPs into one issue when they share a lane,
and don't use the agent for work a deterministic script can do.

> **Plan gotcha (verified 2026-06-12):** the **coding agent is disabled on the Education
> plan** — not included, so Copilot cannot be an *executor* there, only a *reviewer* (code
> review enables independently in repo settings). On Education, route implementation to
> Cursor/Gemini and keep Copilot as the second reviewer in the ensemble. Enabling the coding
> agent requires a plan that includes it (Pro/Business).
