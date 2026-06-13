# CLAUDE.md   *(AFLEK shim template — Claude Code)*

<!--
  TEMPLATE PLACEHOLDERS — replace all {{…}} and delete this comment block.
  {{PROJECT}}                  product name
  {{PROJECT_SUMMARY}}          2–4 sentences: what the repo is, current generation, what is
                               read-only legacy (if any)
  {{STATUS_DOC}}               path to the live status board, e.g. docs/STATUS.md
  {{PLAN_DOC}}                 path to the master plan / decision log
  {{COMMANDS}}                 fenced block: install, build, test, lint, typecheck, deploy,
                               single-package runs — the commands an agent actually types
  {{REPO_MAP}}                 fenced block: top-level directories with one-line purposes,
                               marking ownership lanes (e.g. "contracts — orchestrator-owned")
  {{GUARDRAIL_DIGEST}}         numbered digest of the AGENTS.md guardrails (structural + domain).
                               Keep it a DIGEST — the full text lives in AGENTS.md only.
  {{BRANCH_PREFIXES}}          e.g. spec/NNNN-* · feat/* · fix/* · docs/* · chore/*

  DRIFT RULE (doctrine 5): any policy change updates AGENTS.md AND this shim in the same PR.
-->

This file orients Claude Code in this repository. **The binding contract for all agents is
[`AGENTS.md`](AGENTS.md) — read it in full before changing anything.** This page only adds
Claude-Code-specific operational notes; if the two ever disagree, `AGENTS.md` wins.

## What this repository is

{{PROJECT_SUMMARY}}

Live project state: `{{STATUS_DOC}}` · plan and decision log: `{{PLAN_DOC}}`.

## Commands

{{COMMANDS}}

CI runs build · test · lint · typecheck + secret scan on every PR; `main` is protected.

## Repository map

{{REPO_MAP}}

## Non-negotiables (full versions in AGENTS.md)

{{GUARDRAIL_DIGEST}}

## Session hand-off

Work must never live only in a chat. Before ending a session: push the branch
({{BRANCH_PREFIXES}}), open/update the PR with a Stage Report, and update `{{STATUS_DOC}}` if a
spec or phase changed state (orchestrator-owned — coordinate rather than edit in parallel).
