# GitHub Copilot — {{PROJECT}}   *(AFLEK shim template)*

<!--
  Install as: .github/copilot-instructions.md

  TEMPLATE PLACEHOLDERS — replace all {{…}} and delete this comment block.
  {{PROJECT}}             product name
  {{MAINTAINER}}          the human with merge authority
  {{GUARDRAIL_DIGEST}}    bulleted digest of the AGENTS.md guardrails (structural + domain)
  {{CONTRACT_LANES}}      paths a worker must never edit (orchestrator-owned contracts)
  {{SPEC_DIR}}            where specs live, e.g. /specs/NNNN-*/
  {{CI_GATES}}            what CI runs, e.g. "build/test/lint/typecheck + gitleaks"

  DRIFT RULE (doctrine 5): any policy change updates AGENTS.md AND this shim in the same PR.
-->

**READ `AGENTS.md` at the repository root FIRST (in full).** It is the binding entry contract
for every agent on this project, regardless of provider. This file is a pointer to it.

## Non-negotiable guardrails (authority: `AGENTS.md`)

- **English everywhere:** identifiers, comments, commit messages, docs, schema and API names.
- **No code without a spec.** Implement against the assigned spec in `{{SPEC_DIR}}`.
- **Stay in your lane.** Edit ONLY the assigned package(s). Never touch the shared contracts
  ({{CONTRACT_LANES}}) — orchestrator-owned.
- **Secrets.** Never read/print `private/`. Never commit secrets.
{{GUARDRAIL_DIGEST}}

## Git policy

- Feature branch → commit + push → open PR (Conventional Commits, English).
- 🔒 NEVER commit/push to `main`, NEVER merge. Only {{MAINTAINER}} merges.
- CI ({{CI_GATES}}) must be green before a PR is mergeable.

## When assigned an Issue (coding agent)

Implement exactly the linked spec, satisfy every acceptance criterion, add tests, update docs
per the AGENTS.md documentation matrix, add a changelog fragment, and open a PR referencing the
spec and Issue. Then stop for review.
