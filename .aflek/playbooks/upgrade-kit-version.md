# Playbook — upgrade the kit version in an adopting repo

> FD6: projects pin a kit version in `FLEET-VERSION`; upgrades are **deliberate, reviewed
> events** — never implicit, never partial-by-accident. Executor: the adjutant, as one PR.

## Procedure

1. **Read the kit's release notes** for every version between the pinned one and the
   target. Classify each change: doctrine change · template change · persona/adapter
   change · playbook change.
2. **Decide scope with the maintainer.** Doctrine changes are policy: the maintainer
   accepts or rejects them explicitly (record it in the project's decision log). Template
   changes are mechanical unless the project diverged locally.
3. **Diff your instantiated files against the new templates.** For each template the
   project uses (`AGENTS.md`, shims, CONTRIBUTING, CI, PR template, STATUS, personas):
   re-apply the project's placeholder values and domain sections onto the new template
   text, rather than hand-merging diffs — the placeholders exist precisely so
   re-instantiation is cheap.
4. **Respect the two layers (FD5).** Anything the project wrote into a "project-specific"
   section carries over verbatim. If the upgrade moves a structural rule INTO the kit that
   the project had written locally, delete the local copy — one authority.
5. **Bump `FLEET-VERSION`** to the new tag.
6. **Ship as one PR** titled for the version jump, listing per file: adopted / adapted /
   deliberately skipped (with reason). Skipped items are recorded, not silent.
7. **Run the docs-auditor persona** (Mode B) on the result — an upgrade is exactly where
   shims drift.

## Done when

- `FLEET-VERSION` equals the target tag.
- Every kit change between the versions is adopted, adapted, or recorded as skipped with
  a reason in the PR.
- Entry points pass the drift check; CI is green; the maintainer has merged.
