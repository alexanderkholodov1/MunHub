# GEMINI.md   *(AFLEK shim template — Gemini CLI)*

<!--
  TEMPLATE PLACEHOLDERS — replace all {{…}} and delete this comment block.
  {{PROJECT}}             product name
  {{MAINTAINER}}          the human with merge authority
  {{GUARDRAIL_DIGEST}}    bulleted digest of the AGENTS.md guardrails (structural + domain).
                          Keep it a DIGEST — the authority is AGENTS.md.
  {{CONTRACT_LANES}}      paths a worker must never edit (orchestrator-owned contracts)
  {{CI_COMMANDS}}         the local pre-PR gate, e.g. "pnpm build && pnpm test && pnpm lint"
  {{SPEC_DIR}}            where specs live, e.g. /specs/NNNN-*/

  DRIFT RULE (doctrine 5): any policy change updates AGENTS.md AND this shim in the same PR.
-->

# Gemini — {{PROJECT}}

**READ `AGENTS.md` FIRST (in full).** It is the binding entry contract for every agent on this
project, regardless of provider. Everything below is a pointer to it.

## Non-negotiable guardrails (summary — the authority is `AGENTS.md`)

- **English everywhere:** identifiers, comments, commit messages, docs, schema and API names.
- **No code without a spec / work package.** Implement against the spec in `{{SPEC_DIR}}` you
  were assigned.
- **Stay in your lane.** Edit ONLY the package(s) assigned. Never edit the shared contracts
  ({{CONTRACT_LANES}}) — those are orchestrator-owned.
- **Secrets.** Never read or print anything in `private/`. Never commit secrets.
{{GUARDRAIL_DIGEST}}

## Git policy

- Work on a feature branch; commit + push the branch; open a PR. Conventional Commits, English.
- 🔒 NEVER commit/push to `main`, NEVER merge. Only {{MAINTAINER}} merges.
- Before opening a PR: `{{CI_COMMANDS}}` must pass.

## Definition of Done

All spec acceptance criteria checked + tests + docs updated per the AGENTS.md documentation
matrix + changelog fragment + CI green + PR opened with the Stage Report. Then STOP.
