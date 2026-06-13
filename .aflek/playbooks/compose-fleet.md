# Playbook — compose the fleet (run at the start of EVERY milestone)

> The fleet has **no fixed hierarchy.** Its shape is *composed* for each milestone as a function
> of three variables: the **complexity of the task**, the **agents alive right now**, and the
> **optimisation target** (time, quality, token/quota spend). A one-file translation needs one
> executor and no ceremony; translating an entire corpus needs squads with squad-leads who check
> partial consistency before the Adjutant checks the macro objective. Same fleet, different shape.
>
> This playbook is the **mandatory first step** of any milestone — before `run-a-wave`, before
> any dispatch. Its output is an **approval tree** the maintainer sees and approves. No model may
> skip it: whoever boots AFLEK (Haiku, Sonnet, Opus) runs *this*, proposes a structure, and waits
> for the maintainer — it never executes blind. Robustness does not come from the booting model
> being smart; it comes from the first action always being *assess and propose*, never *execute*.

---

## Step 1 — Discover (which agents are alive, right now)

Probe **every** provider in the registry; never assume last session's roster. Providers change
between runs without notice, and one may be down — the fleet must adapt and **say so on the
monitoring board.**

- Run the health probe (`tools/fleet-status.ps1` reports each provider UP/DOWN). Registry today:
  **Gemini CLI**, **Cursor API** (Bearer), **GitHub** (PAT push), **Vercel API**, **Claude
  subagents** (in-harness, always available), **Copilot** (review-only on Education).
- Record each as UP / DOWN / DEGRADED with the evidence (HTTP code, CLI reply). A DOWN provider
  is **removed from this milestone's available pool** and flagged on the board — the composition
  works around it, it does not stall waiting.
- New provider in `private/` + an adapter in `adapters/`? It joins the pool automatically. The
  registry is data, not code — extensible without touching this playbook.

## Step 2 — Classify the task's complexity

| Tier | Signals | Typical shape |
|---|---|---|
| **Trivial** | 1 file / 1 lane, deterministic, low risk | 1 executor, no supervisor, auto-approved |
| **Bounded** | one package/domain, mechanically checkable | a few executors → 1 reviewer → Adjutant |
| **Large** | many files across a domain, cross-file coherence matters | squads of executors → **squad-leads** (partial consistency) → Adjutant (macro) |
| **Huge** | multi-domain, interdependent, high risk | **supervisors of supervisors**: Opus reviews 2 Sonnets, each leading a squad of Gemini/Cursor |

Complexity is about *coherence surface and risk*, not raw file count: 21 translations with one
shared glossary is Large (coherence binds them); 21 unrelated configs is Bounded.

## Step 3 — Compose the structure

Derive depth and width from **complexity × live agents × optimisation target**:

- **Depth** (how many review layers): trivial = 0, bounded = 1, large = 2, huge = 3. Add a layer
  only when a human-scale reviewer can't hold the whole surface in one pass.
- **Width** (executors per squad): bounded by the cheap-tier daily caps and by what a single
  squad-lead can actually review. A squad too wide to review is two squads.
- **Optimisation**: route mechanical bulk to the cheapest UP executor (Gemini); reserve frontier
  quota (Opus) for the macro review and for genuinely hard reasoning; never spend the scarce tier
  on what a cheap tier does well.

## Step 4 — Assign roles (by aptitude × cost, NOT fixed per model)

Roles are assigned per milestone, not hard-wired to a model. The same model is a different role
on a different task:

| Role | What it does | Who (example, varies by milestone) |
|---|---|---|
| **Adjutant** | macro plan, final coherence review, the single PR | Opus when the task needs macro vision; may stay Sonnet if simple |
| **Squad-lead** | assigns a squad, checks partial consistency, reports up | Sonnet, or Cursor(Claude) — sometimes Gemini for a bulk squad |
| **Specialist** | a focused job *outside* the squads (e.g. research first) | a Claude subagent doing web research; a physicist persona |
| **Executor** | one acotada task, reports to its lead — never opens a PR | Gemini (bulk), Cursor (UI/cloud), a Claude subagent (logic) |
| **Reviewer** | cross-provider check before the PR (author ≠ reviewer, D35) | Copilot review, a persona, or a different provider than the author |

> A Claude subagent is **not** confined to research/architecture. On one milestone it leads a
> squad; on another it is the lone specialist; on another it is an executor. The composition
> decides, per task.

**Model elevation is a proposal, not magic.** A booting Sonnet/Haiku cannot turn itself into Opus
— it does not control its own session model. What it does is *propose* "the Adjutant role needs
Opus for this; here is the tree and the quota," and the maintainer makes the switch. The system is
robust because the proposal always happens, not because the agent self-elevates.

## Step 5 — Estimate quota & time

Per role, estimate tokens/quota (frontier vs cheap vs free) and wall-clock. Feed the running
**quota ledger** (estimate vs actual, recorded at close) so estimates improve each milestone.

## Step 6 — Present the tree & get approval

Emit the **wave plan** (`templates/wave-plan.template.md`): live roster (UP/DOWN), task tier,
the composed tree (who supervises whom, who executes what), per-provider quota estimate, and the
disjoint-lane manifest for the preflight gate. **The maintainer sees this and approves before any
execution.** To adjust without spending any quota negotiating, the maintainer edits the plan
directly in **`tools/fleet-console.html`** — toggle providers on/off, change a model's role or
command, re-level supervision, add a model — and exports the edited `wave-plan.json`; the
orchestrator then executes exactly that. Editing is local and free; the dialogue stays out of chat. Escalation rule (the maintainer delegated the threshold): trivial + cheap/free →
proceed on the automatic preflight; anything spending frontier/paid quota, or Large/Huge, or
touching production → explicit approval first. When in doubt, show it.

## Step 7 — Execute

`wave-preflight.ps1` must pass (disjoint lanes, reachable executors, dependency-clear queue).
Launch per `run-a-wave`. Keep `fleet-status.ps1` live (Monitor) so the maintainer watches roster
health, who is doing what, review state, and quota burn in real time — not a black box.

## Step 8 — Consolidate (squad-leads → Adjutant → ONE PR)

Executors report to their squad-lead via `templates/worker-report.template.md` (what was done,
files touched, problems, self-check) — **they do not open PRs.** The squad-lead checks partial
consistency, consolidates the squad's work onto one branch, and reports up. The Adjutant runs the
**postflight**: verifies the parts form a coherent whole that meets the macro objective (not just
that each part passes), then opens **one PR for the milestone.** One milestone = one PR.

## Step 9 — Learn (harden for next time)

At close, record to the incident log (`playbooks/incident-log.md`): conflicts between executors,
between squad-leads, delays, skipped steps, a provider that went down. Each incident yields a
concrete hardening (a gate check, a doctrine line, a registry fix) so the *next* composition is
better. No silent failures: an incident the maintainer had to point out is itself an incident.

---

## Canonical examples

- **Translate one file.** Trivial → 1 Gemini executor, depth 0, auto-approved. No squads, no
  Cursor, no Vercel, no Adjutant review beyond a glance. One PR.
- **Translate all of `planning/`.** Large → several Gemini executors split by batch → 1 squad-lead
  (Sonnet) checks glossary/term consistency across batches → Adjutant checks the macro objective
  and opens **one** PR. Vercel/Copilot-agent stay OFF (not needed). (This is the milestone that,
  done wrong, became 5 fragmented PRs.)
- **Multi-package feature with research.** Huge → a Claude specialist does research first → Opus
  Adjutant composes 2 squad-leads (Sonnet), each leading a squad (Gemini docs/tests + Cursor UI) →
  postflight coherence review → one PR. Vercel UP for preview deploys; if Cursor is DOWN that day,
  its lane re-routes to Claude subagents and the board flags the substitution.
