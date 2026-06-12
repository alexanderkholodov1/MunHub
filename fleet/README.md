# The Fleet — seed charter

> **Status: incubating.** This folder is the seed of a **separate repository** (working name:
> `fleet`). It lives in MunHub temporarily so the plan survives outside any chat; extraction is
> WP-10 in `docs/audit/2026-06-12-STATE-OF-PROJECT.md`. Nothing in MunHub may depend on this
> folder.

## Mission

A **project-agnostic, provider-agnostic agent fleet kit**: drop it into any new repository (web,
full-stack, software, research) and get a working multi-agent development system — command
structure, quality gates, work-packaging format, and provider adapters — without rebuilding the
machinery every time. MunHub is the first customer, not the owner.

## Doctrine (lessons already paid for)

1. **Cloud-first execution.** Implementer agents run on cloud surfaces (Claude Code web/cloud
   sessions & Routines, Cursor Cloud Agents, Copilot coding agent, GitHub-Actions agents like
   `anthropics/claude-code-action`) — never as parallel processes on the operator's machine.
   Local CLIs are for single interactive sessions only.
2. **The PR is the deliverable; CI is the referee.** Agents commit to feature branches, open
   PRs; protected `main`; only the human merges. Provider-agnostic by construction — every
   vendor's agent can emit a PR.
3. **No gateway products in the loop.** Personal-assistant gateways (OpenClaw, Hermes Agent)
   are out of scope: wrong genus (chat assistants, not build orchestrators) and, for OpenClaw,
   a disqualifying security record. Re-evaluate the landscape quarterly.
4. **The work package is the unit of delegation.** A WP contains: goal, the ONLY files/context
   needed, constraints, acceptance criteria (mechanically checkable where possible), docs to
   update, and a suggested executor tier. If a mid-tier model can't execute a WP alone, the WP
   is underspecified — fix the WP, not the model.
5. **One canonical contract, thin adapters.** A single `AGENTS.md` is the authority; per-harness
   shims (`CLAUDE.md`, `GEMINI.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`)
   are pointers that must never drift. (Pattern generalized from MunHub; equivalent to ECC's
   `.agents/` + adapter-contract architecture — see `everything-claude-code`,
   `docs/SESSION-ADAPTER-CONTRACT.md`, MIT.)
6. **No chat-dependent state.** Sessions end with pushed branches, PR stage reports, and a
   status board update. Any plan of record lives in the repo.
7. **Routing by strength, reviewing across providers.** Frontier model designs contracts and
   reviews; mid-tier implements; cheap tier does mechanical bulk; a *different* provider reviews
   (ensemble catches more than self-review). Defense-in-depth gates per PR: CI + secret scan +
   coverage + two automated reviewers + persona reviews where relevant.

## v0.1 contents (extraction targets)

| Asset | Source to generalize |
|---|---|
| `AGENTS.md` template + shim set + drift rule | MunHub `AGENTS.md` (2026-06-12 revision) and its shims |
| Documentation matrix ("done includes docs") | `AGENTS.md` guardrail 10 |
| Commit/PR style standard (no process narration) | MunHub `CONTRIBUTING.md` D44 section |
| Changelog-fragments pattern (parallel-PR safe) | `changelog.d/` |
| CI quality-gate workflow + secret scan | `.github/workflows/ci.yml`, `.gitleaks.toml` |
| PR template + CODEOWNERS + label taxonomy | `.github/` |
| Work-package format + status board template | `docs/audit/2026-06-12-STATE-OF-PROJECT.md` §7, `docs/STATUS.md` |
| Command structure (operator → adjutant → supervisors → workers) | `planning/20-FLEET-COMMAND-AND-ADJUTANT.md` (translate + de-project-ify) |
| Routing matrix + wave/lane/contracts-first scheduling | `planning/18-AGENT-FLEET-ORCHESTRATION.md` §2–§3, §7–§8bis |
| Reviewer personas (code, security, silent-failure) | adapted from `everything-claude-code` (pin commit, MIT attribution) |
| Secrets pattern (`private/` + env loader + committed example) | `infra/fleet/` |

## Repo skeleton (target)

```
fleet/
├─ README.md            mission + quickstart ("adopt the fleet in an existing repo")
├─ doctrine/            the 7 rules above, each with rationale
├─ templates/           AGENTS.md, shims, CONTRIBUTING, PR template, CI workflows,
│                       changelog.d, STATUS board, work-package + spec templates
├─ personas/            reviewer/persona definitions (canonical, harness-neutral)
├─ adapters/            claude-code/, cursor/, gemini/, copilot/, codex/ — how each
│                       harness consumes the canonical contract
└─ playbooks/           bootstrap-new-project, adopt-in-existing-repo, run-a-wave,
                        phase-audit, incident (agent went rogue / broke main)
```

## Explicit non-goals

- Building an orchestration runtime/daemon. The vendors' cloud surfaces are the runtime; the
  fleet kit is contracts, templates, and playbooks — the part that survives vendor churn.
- Tracking every new agent tool. Quarterly landscape review, adopt only what removes a step.
