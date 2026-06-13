# Playbook — start (the "empieza" flow)

> **Trigger:** the operator opens a session in an adopter project and says **"empieza" /
> "procedemos con la implementación" / "start"**. Nothing else is required — no context from a
> prior chat, no model in particular. Whoever boots runs THIS, top to bottom. It is the single
> universal entry point; it must behave identically under Haiku, Sonnet, Opus, or Fable.
>
> The operator's deal: he types one word and the fleet self-reviews, self-updates, self-organises,
> proposes a role distribution he approves, executes under live monitoring, reviews its own output,
> opens **one** PR only when the work is truly done, and learns from the run. This playbook is that
> contract, made executable.

---

## 0. Identity (already loaded)

The machine-level pointer (`~/.claude/CLAUDE.md`) has loaded the overlay: ADJUTANT.md (role),
OPERATOR-PROFILE.md, memory. You are the Adjutant. You do not ask the operator to confirm trivia,
and you never leave work in a chat. If you are missing identity, stop and load the overlay first.

## 1. Self-review (auto) — `tools/aflek-selftest.ps1`

Run the selftest. It checks, and reports as a single board:
- **Provider roster** live (Gemini, Cursor, GitHub, Vercel, Claude subagents, Copilot) — UP/DOWN.
- **Sync drift** (`aflek-sync -Check`): is the project behind the kit?
- **Gates present** (wave-preflight, fleet-status, load-fleet-env) and runnable.
- **Secrets** loadable (without printing them).

A DOWN provider is noted and excluded from this run's pool — the composition works around it, it
does not stall. If a gate or secret is missing, fix it before composing (that is part of the job,
not a question for the operator).

## 2. Self-update (auto) — `tools/aflek-sync.ps1`

If the selftest reports drift, run the full sync: pull the kit, materialise `.aflek/`, refresh
personas, bump `FLEET-VERSION`. Commit it as the first small chore of the session if anything
changed. The project now runs current doctrine.

## 3. Orient — what is the next milestone

Read the project's `docs/STATUS.md` + backlog and pick the **highest-priority milestone with no
unmerged dependency** (contracts-first). State it in one line: the macro objective and what "done"
means. This is the unit the session will deliver as one PR.

## 4. Self-organise — `playbooks/compose-fleet.md`

Compose the fleet for THIS milestone from complexity × live roster × optimisation: depth, width,
roles by aptitude×cost. Produce the **wave plan** (`templates/wave-plan.template.md`): roster, tier,
tree, quota estimate, disjoint-lane manifest.

## 5. Propose & get approval

Present the wave plan. The operator may approve as-is, or adjust it **without spending quota** in
`tools/fleet-console.html` (toggle providers, edit roles/commands, re-level, add a model) and hand
back the edited `wave-plan.json`. Escalation (operator-delegated threshold): trivial + free →
proceed on the preflight automatically; frontier/paid or large/huge or production → explicit
approval. When in doubt, show it. **This is the one human gate by design — do not skip it for
non-trivial work, and do not invent extra questions around it.**

## 6. Execute under live monitoring

`wave-preflight.ps1` must pass. Launch per `run-a-wave`. Keep `fleet-status.ps1` live (Monitor) so
the operator watches roster health, who is doing what, review state, and quota burn in real time.

## 7. Consolidate & self-review the output

Executors file `worker-report.template.md` to their squad-lead — **no worker opens a PR.** The
squad-lead checks partial consistency and consolidates onto one branch. The Adjutant runs the
**postflight**: the parts form a coherent whole that meets the macro objective, cross-provider
review done (author ≠ reviewer, D35), CI green, docs + changelog updated. **Not done = keep working
on the same branch.** No partial, unreviewed, or unverified work gets a PR — ever.

## 8. One PR — only when truly done

Open exactly one PR for the milestone, only after step 7 fully passes. Update `docs/STATUS.md` in
that same PR. The operator merges; agents never do.

## 9. Self-improve

Append the wave to `journal/<project>.md` (delivered/friction/improvement/upstream). Log any
incident to `incident-log.md` with the concrete hardening shipped — an incident the operator had to
point out is itself an incident. Write durable lessons to memory. Generalisable, anonymised
hardenings flow back to the kit as the single public feedback loop (`learning-loop.md`).

---

## The one-word contract

```
operator: "empieza"
  → 1 selftest        (auto)
  → 2 self-update     (auto)
  → 3 orient          (auto: next milestone from STATUS/backlog)
  → 4 compose fleet   (auto: roles for THIS milestone)
  → 5 PROPOSE         → operator approves / edits in the console   ← the human gate
  → 6 execute         (live monitoring)
  → 7 self-review     (postflight; not done → keep working, same branch)
  → 8 ONE PR          (only when truly done; operator merges)
  → 9 self-improve    (journal, incident-log, memory, kit feedback)
```

Steps 1–4 and 6–9 are autonomous. Step 5 is the only point that waits for the operator. Everything
else the Adjutant does on its own — because that is what an Adjutant is.
