# Doctrine — the seven rules

> Each rule states the law, the reasoning behind it, and the **failure it prevents** — a real
> incident, not a hypothetical. The casebook is the kit's first adopting project (a public
> scientific monorepo; project audit of June 2026). When a rule costs you
> something and you are tempted to waive it, reread the failure first.
>
> Doctrine changes are PRs against this file with a new incident or a new argument — never
> silent drift in a template.

---

## 1. Cloud-first execution

**Rule.** Implementer agents run on cloud surfaces — Claude Code web/cloud sessions and
Routines, Cursor Cloud Agents, Copilot coding agent, GitHub-Actions agents (e.g.
`anthropics/claude-code-action`). Local CLIs are for **one interactive session at most**:
the operator's adjutant. Never fan out parallel agent processes on the operator's machine.

**Rationale.** Cloud surfaces give isolation, parallelism that scales with the vendor's
hardware (not the operator's laptop), and a uniform feedback artifact: the PR. A local swarm
gives none of these and competes with the operator for CPU, RAM, and attention.

**Failure it prevents.** *First adopter, June 2026.* AFLEK design ran multiple provider CLIs as
parallel local processes. The result: a degraded workstation, no visible progress surface,
and work that died with the terminal. The fix was doctrinal, not architectural — move
execution to cloud surfaces and make the PR queue + status board the only feedback channels.

## 2. The PR is the deliverable; CI is the referee

**Rule.** Agents commit to feature branches and open PRs. `main` is protected; only the human
operator merges. Every PR carries a stage report. CI (build, test, lint, typecheck, secret
scan) gates the merge mechanically.

**Rationale.** The PR is the one artifact every vendor's agent can emit, so the kit stays
provider-agnostic by construction. Small agent commits on branches preserve the audit trail;
protection plus CI means trust is enforced, not assumed.

**Failure it prevents.** *First adopter, defect audit.* An earlier "agents never commit —
leave changes for the human" policy (D30) discarded the audit trail, left work stranded in
working trees, and survived in sixteen stale GitHub issues that contradicted the active
policy — new agents read the wrong law. Industry practice (2026) is the opposite of D30:
agents commit small, branch-scoped, PR-gated. The superseded policy had to be hunted out of
every surface it had leaked into.

## 3. No gateway products in the loop

**Rule.** Personal-assistant gateways (OpenClaw, Hermes Agent, and their genus) are out of
scope as orchestrators. The vendors' own cloud coding agents are the runtime; MCP is the
shared tool layer, not the orchestrator. Re-evaluate the landscape quarterly — adopt only
what removes a step.

**Rationale.** Gateways are chat assistants, not build orchestrators: wrong unit of work
(messages, not PRs), and an extra trust boundary holding your credentials.

**Failure it prevents.** *Landscape research, 2026-06-12.* OpenClaw at evaluation time:
~135k internet-exposed instances, 36% of marketplace skills carrying prompt injection
(Snyk ToxicSkills), an active malicious-skill campaign, plaintext key storage — disqualifying
for any project holding repository and database credentials. Hermes Agent was better
engineered but orchestrating external coding CLIs was an open feature request, not a
capability. Adopting either would have inserted an unproven security boundary to gain
nothing the PR queue didn't already provide.

## 4. The work package is the unit of delegation

**Rule.** Work is delegated as a work package (WP): goal, the ONLY files/context needed,
constraints, mechanically checkable acceptance criteria, docs to update, suggested executor
tier. If a mid-tier model cannot execute a WP alone, the WP is underspecified — **fix the WP,
not the model.**

**Rationale.** "A mid-tier model can do it" is a property of the specification, not of the
model. Well-formed WPs make routing a cost decision instead of a gamble, and make failure
attributable: either the WP was wrong or the executor ignored it.

**Failure it prevents.** *First adopter audit, defect 8.* An architecture decision record was
delegated without a decision contract and came back ending in a question to the maintainer —
work that consumed a session and still required the expensive resource (human judgment) it
was supposed to package. Underspecified tasks silently escalate themselves to the frontier
model or to the human; the WP format is what stops that.

## 5. One canonical contract, thin shims

**Rule.** A single `AGENTS.md` is the authority for agent behavior in an adopting repo.
Per-harness files (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/*.mdc`,
`.github/copilot-instructions.md`) are thin pointers plus harness-specific operational notes.
Any policy change updates the canonical file **and all shims in the same PR** (the
documentation-matrix rule).

**Rationale.** Every harness reads a different file; without a single source of truth they
diverge independently, and each new agent session is initialized by whichever stale copy its
harness happens to read.

**Failure it prevents.** *First adopter audit, defects 1–2.* The repo's `CLAUDE.md` still
described a dead previous-generation architecture ("no build step, no test suite") while the
codebase was a pnpm monorepo with CI; `AGENTS.md` was in the wrong language for a public repo
and contradicted itself on commit policy between two of its own sections. Every new session
started misinformed and had to be corrected mid-task — the most expensive possible place.

## 6. No chat-dependent state

**Rule.** Sessions end with pushed branches, PR stage reports, and a status-board update.
Any plan of record lives in the repository (audit docs, planning docs, STATUS) — never only
in a conversation. A future session must be able to resume from the repo alone.

**Rationale.** Chats expire, get summarized, or belong to one provider. The repo is the only
memory all providers, all sessions, and the human share.

**Failure it prevents.** *First adopter audit, defect 10.* The status board went five days
stale and did not know two foundation PRs were open — the actual phase blocker was sitting
invisible in a merge queue while plans lived in chat histories nobody could query. The audit
rule since: the board is updated at the close of every wave, and "the repository is the
memory" is the first line of the session bootstrap.

## 7. Routing by strength, reviewing across providers

**Rule.** Frontier models design contracts and review; mid-tier models implement; cheap
tier does mechanical bulk. A **different provider** than the author reviews each PR.
Defense-in-depth per PR: CI + secret scan + coverage gate + at least two automated reviewers
+ persona reviews (security, silent-failure, code quality) where relevant.

**Rationale.** Cost: frontier tokens spent on mechanical work are wasted; mid-tier tokens
spent on contract design are worse than wasted. Quality: models share blind spots with
themselves; an ensemble across providers catches what self-review structurally cannot.

**Failure it prevents.** *First adopter, ongoing.* Single-reviewer setups silently degrade when the
one reviewer is misconfigured or its billing lapses — exactly what happened when one paid
review bot was turned off for cost (Cursor Bugbot, 2026-06-12) and the review ensemble had
to absorb the loss without dropping below two reviewers. Cross-provider review also caught
self-consistent-but-wrong claims (an overstated scientific superlative repeated uniformly
across docs) that the authoring model kept reproducing because it had written them.
