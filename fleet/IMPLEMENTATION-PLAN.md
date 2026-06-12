# The Fleet — implementation plan (v0.1 → v1.0)

> **Audience:** the maintainer and the agent session that will build `alexanderkholodov1/fleet`.
> Self-contained: requires only this `fleet/` folder and read access to MunHub. The charter
> (mission, doctrine, non-goals) is [`README.md`](README.md); this document is the **how**.

---

## 1. What is being built (one paragraph)

A repository of **contracts, templates, personas, and playbooks** that turns any repo into a
multi-agent development project in under an hour: one canonical agent contract with thin
per-provider shims, a work-package format that makes tasks executable by mid-tier models, a
defense-in-depth review pipeline, and operating playbooks for the human + adjutant pair. It is
**not a runtime**: vendors' cloud agents (Claude Code web/Routines, Cursor Cloud, Copilot,
Codex, GitHub Actions) execute; the kit makes them interchangeable and the output uniform
(PRs gated by CI). MunHub is the proof: the kit is extracted from what already works there, and
MunHub becomes its first consumer.

## 2. Design decisions (FD-log — the kit's own decision log)

| # | Decision | Rationale |
|---|---|---|
| FD1 | **Kit, not runtime** | Orchestration daemons rot with vendor churn; contracts and playbooks survive it. Vendors compete to run agents for us. |
| FD2 | **Cloud-first execution** | Local fan-out degraded the operator's machine and hid feedback (MunHub, June 2026). Local CLIs = one interactive session max. |
| FD3 | **One canonical `AGENTS.md`, shims point to it** | Multi-file drift is how MunHub's entry points went stale; the doc-matrix rule makes shims update in the same PR. |
| FD4 | **Work package = unit of delegation** | "Even a mid-tier model can do it" is a property of the WP, not the model. Underspecified WP → fix the WP. |
| FD5 | **Two-layer contract: kit structure + project domain** | Templates carry `{{PLACEHOLDERS}}` and a mandatory "project-specific guardrails" section; domain rules (e.g. MunHub's scientific honesty) never live in the kit. |
| FD6 | **Projects pin a kit version** | `FLEET-VERSION` file in adopting repos; SemVer tags on the kit; upgrades are deliberate (playbook), never implicit. |
| FD7 | **English, MIT, public** | Same reasoning as MunHub D14/D28. Third-party-derived files (ECC personas) keep attribution headers. |
| FD8 | **The PR is the only deliverable; the status board is the only feedback surface** | Uniform across providers; the human reads one queue and one board, never N chat logs. |

## 3. Target repository skeleton (v0.1)

```
fleet/
├─ README.md                      charter (from this folder) + quickstart
├─ LICENSE                        MIT
├─ FLEET-VERSION                  0.1.0 (the kit's own version)
├─ doctrine/
│  └─ DOCTRINE.md                 the 7 rules, each with rationale + the failure it prevents
├─ templates/
│  ├─ AGENTS.template.md          canonical agent contract (placeholders)  ← in this folder
│  ├─ shims/
│  │  ├─ CLAUDE.template.md       harness pointer + ops notes
│  │  ├─ GEMINI.template.md       pointer + guardrail digest
│  │  ├─ cursor-rules.template.mdc       (.cursor/rules/00-agents.mdc)
│  │  └─ copilot-instructions.template.md (.github/)
│  ├─ CONTRIBUTING.template.md    commit/PR style (no process narration) + DoD
│  ├─ changelog.d-README.md       parallel-PR-safe changelog fragments
│  ├─ STATUS.template.md          status board (phases, specs in flight, gates, action queue)
│  ├─ work-package.md             WP format                                ← in this folder
│  ├─ spec.template.md            SDD spec format (goal, AC, lanes, tests)
│  └─ github/
│     ├─ ci.template.yml          build/test/lint/typecheck + secret scan (stack-pluggable)
│     ├─ pull_request_template.md spec ref, AC checklist, self-review, risks
│     └─ CODEOWNERS.template      contract-lane ownership routing
├─ personas/
│  ├─ code-reviewer.md            correctness/regression review
│  ├─ security-reviewer.md        deny-by-default, secrets, boundary validation
│  ├─ silent-failure-hunter.md    swallowed errors, dead listeners, empty catches
│  └─ docs-auditor.md             doc-matrix compliance + drift detection
├─ adapters/
│  ├─ claude-code.md              sessions, subagents, Routines, claude-code-action; shim wiring
│  ├─ cursor.md                   Cloud Agents, rules dir; billing cautions (Bugbot usage-billed)
│  ├─ gemini.md                   Gemini CLI free tier; GEMINI.md wiring
│  ├─ copilot.md                  Issue→PR coding agent + code review
│  └─ codex.md                    Codex Cloud parallel tasks
└─ playbooks/
   ├─ bootstrap-new-project.md    empty repo → working fleet project       ← in this folder
   ├─ adopt-existing-repo.md      retrofit (MunHub is the worked example)
   ├─ run-a-wave.md               the orchestrator loop                    ← in this folder
   ├─ phase-audit.md              completeness audit at phase close (MunHub audit as model)
   ├─ upgrade-kit-version.md      consume a new kit tag deliberately (FD6)
   └─ incident.md                 broken main / rogue agent / leaked secret / lost session
```

## 4. Build work packages (FWP) — for the session that builds the repo

Every FWP: one PR, acceptance criteria mechanically checkable, MunHub read-only as source.

| FWP | Deliverable | Source → transformation | Acceptance |
|---|---|---|---|
| 01 | Repo bootstrap: README, LICENSE, FLEET-VERSION, `doctrine/DOCTRINE.md` | this folder's README verbatim + expand each doctrine rule with "failure it prevents" (use MunHub audit §2.2 as the casebook) | files exist; README quickstart ≤ 1 screen; CI badge optional |
| 02 | `templates/AGENTS.template.md` + 4 shims | `fleet/templates/AGENTS.template.md` (already drafted) + MunHub's `GEMINI.md`, `.cursor/rules/00-agents.mdc`, `.github/copilot-instructions.md`, `CLAUDE.md` with project facts → `{{PLACEHOLDERS}}` | placeholders documented at top; no MunHub-specific nouns left (`rg -i 'munhub\|cosmic\|detector'` clean except in examples marked as examples) |
| 03 | `templates/CONTRIBUTING.template.md`, `changelog.d-README.md`, `STATUS.template.md`, `spec.template.md` | MunHub `CONTRIBUTING.md` (keep the D44 do/don't table verbatim — it is the crown jewel), `changelog.d/README.md`, `docs/STATUS.md` structure, `planning/03` spec template | same de-projectification check |
| 04 | `templates/github/*` | MunHub `.github/workflows/ci.yml` (factor stack-specific steps behind a clearly-marked block), PR template, CODEOWNERS | template CI parses (`yamllint`); placeholder block documented |
| 05 | `personas/*` (4 files) | adapt from `everything-claude-code` @ pinned commit (note SHA in each header, MIT attribution) + `docs/audit` §3.1 guidance; make stack-neutral with a "project specializations" footer | each persona ≤ 120 lines; attribution headers present |
| 06 | `adapters/*` (5 files) | distill `docs/audit` §3.2 landscape + each vendor's current docs (re-verify at build time — the landscape moves) | each adapter answers: how to start a task, where it runs (cloud/local), how the shim is wired, cost/billing cautions, last-verified date |
| 07 | `playbooks/*` (6 files) | `run-a-wave.md` + `bootstrap-new-project.md` already drafted here; write the other four; `adopt-existing-repo.md` uses MunHub as the worked example; `phase-audit.md` generalizes the 2026-06-12 MunHub audit method; `incident.md` includes the lost-write-access scenario (2026-06-12: keep committing locally, export patches to the operator) | every playbook is a numbered procedure with an explicit "done when" |
| 08 | **MunHub adoption pass** (in MunHub, not the kit) | replace nothing wholesale; add `FLEET-VERSION`, reconcile any divergence between MunHub files and kit templates (expected: none — the kit was extracted from MunHub), delete `fleet/` from MunHub | MunHub CI green; `fleet/` gone; STATUS notes adoption |
| 09 | Tag `v0.1.0` + GitHub repo description/topics | — | tag exists; release notes generated from the FWP list |

**Sequencing:** FWP-01 → 02 → {03,04,05 in parallel} → 06 → 07 → 09 → 08.
**Routing:** FWP-01/02/07 orchestrator-grade (Adjutant/Opus); 03/04/05/08 mid-tier (Sonnet);
06 needs web verification (Claude + search). All cloud sessions.

## 5. v0.2+ candidates (do NOT build into v0.1)

- **Eval harness** for WPs (post-merge scoring of AC compliance) — adapt ECC `skills/eval-harness`.
- **Memory/instincts** pattern for cross-session learning — watch ECC `continuous-learning-v2`, unproven.
- **Routines recipes** (scheduled audits, dependency bumps, PR babysitting).
- **Project-state JSON schema** so dashboards can be generated from STATUS automatically.
- A second adopting project (the real generalization test — expect template fixes).

## 6. Bootstrap instructions for the build session

1. Session must have write scope on `alexanderkholodov1/fleet` and read on MunHub.
2. Copy this folder's five files into the new repo per the skeleton (charter → `README.md`,
   this plan → `docs/IMPLEMENTATION-PLAN.md` there), commit to `main` while the repo is empty,
   then immediately protect `main` and switch to branch+PR discipline (eat your own dog food).
3. Execute FWP-01…09 as PRs; the operator merges; update the kit's own STATUS board each wave.
4. On completion, run FWP-08 in MunHub via a normal MunHub branch+PR.
