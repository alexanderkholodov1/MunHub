# AGENTS.md — Agent entry point (START HERE)   *(AFLEK template)*

<!--
  TEMPLATE PLACEHOLDERS — replace all {{…}} and delete this comment block.
  {{PROJECT}}            product name, e.g. "Atlas Platform v2.0"
  {{PROJECT_SUMMARY}}    1–3 sentences: what is being built and for whom
  {{MAINTAINER}}         the human with merge authority
  {{STATE}}              current phase, what's merged, what's in flight (keep this LIVE)
  {{GLOSSARY}}           the 2–5 domain terms agents must never confuse
  {{READING_ORDER}}      numbered list: plan → architecture → data model → backlog → domain docs
  {{DOMAIN_GUARDRAILS}}  project-specific non-negotiables (see note below) — the kit deliberately
                         owns only the STRUCTURAL rules; domain truth lives with the project
  {{VERTICAL_SLICE}}     the end-to-end MVP that gates breadth-first work
  {{BRANCH_PREFIXES}}    e.g. spec/NNNN-* · feat/* · fix/* · docs/* · chore/*
  {{STATUS_DOC}}         path to the live status board, e.g. docs/STATUS.md
-->

> If you are an agent (any provider, any model) picking up work on {{PROJECT}}: **read this file
> first, in full, before touching anything.** It is the binding entry contract. Provider shims
> (`GEMINI.md`, `.cursor/rules/00-agents.mdc`, `.github/copilot-instructions.md`, `CLAUDE.md`)
> are pointers to this document.

## What this is

{{PROJECT_SUMMARY}}

**Current state:** {{STATE}}

**Key vocabulary:** {{GLOSSARY}}

**Command structure:** the **maintainer** ({{MAINTAINER}}) sets the vision, approves decisions,
and is the only one who merges. The **Adjutant** (the orchestrator session the maintainer talks
to directly) plans waves, routes work packages, reviews, integrates, and reports. **Supervisor
agents** own an area; **worker agents** execute one work package in their lane. Workers and
supervisors follow their WP and these rules; cross-cutting decisions go through the Adjutant
and the maintainer.

## Required reading order

{{READING_ORDER}}

> Workers assigned a work package read ONLY the files their WP lists. This order is for
> supervisors and orchestrators.

## Guardrails (non-negotiable)

1. **Git policy.** Work on a feature branch ({{BRANCH_PREFIXES}}), one worktree per task. At
   each milestone: commit (Conventional Commits, English, agent trailer), push **your branch**,
   open/update the **PR** with a Stage Report → STOP for review. 🔒 NEVER commit or push to
   `main`, never merge — **only the maintainer merges.** No green CI → not mergeable.
2. **No code without a spec / work package.** If none exists, write it first → human gate →
   build.
3. **Respect the decision log.** Propose changes (PR comment, issue, Stage Report); never
   change a recorded decision unilaterally.
4. **Stay in your lane.** Edit only what your WP lists. Shared contracts are
   orchestrator-owned.
5. **Leave a trace.** Update spec/WP status and the related issue; add a changelog fragment;
   never leave project state only in a chat.
6. **English everywhere.** Code, comments, commits, docs, schema, API names.
7. **Documentation is part of "done".** A PR that changes behavior, structure, or policy
   without updating its documentation is incomplete. Matrix:

   | If your change touches… | Update in the SAME PR |
   |---|---|
   | User-visible behavior / a feature | relevant technical doc · user doc · spec status · changelog fragment |
   | Architecture, packages, stack | architecture doc · README structure/stack blocks · `CLAUDE.md` commands if changed |
   | Data schema or shared contracts | data-model doc · migration notes |
   | Domain rules ({{e.g. science, legal, finance}}) | the domain foundation doc (requires domain-persona review) |
   | UI / design | design-system conformance checklist · screenshots in the PR |
   | Process or agent policy | this file **and** all provider shims — they must never drift |
   | Phase/spec state | {{STATUS_DOC}} (orchestrator-owned — coordinate, don't edit in parallel) |
   | Anything | a `changelog.d/<slug>.<category>.md` fragment |

8. **Commit and PR style.** State **what the change delivers** for a human reading history.
   Never narrate process or frame a change as a reaction to review ("as requested", "now
   without X"). The negotiation stays in the chat; the history records what the project gained.
9. **Secrets.** Never read aloud, print, or commit anything under `private/` or any credential.
   Config shape is documented in `.env.example`; real values travel by environment.

## Project-specific guardrails

<!-- The kit owns structure; the project owns truth. Put domain non-negotiables here, e.g.
     a research platform: scientific honesty (never label unverified events as confirmed
     detections); aggregates must stay statistically comparable; data-layer abstraction only. -->
{{DOMAIN_GUARDRAILS}}

## The first vertical slice

{{VERTICAL_SLICE}}

## How to pick your first task

1. Take your assigned work package, or the highest-priority unblocked item on the backlog.
2. No spec/WP for it? Write one (templates in AFLEK) → human gate → build.
3. Verify against acceptance criteria, then: branch → commit → push → PR + Stage Report → stop.
