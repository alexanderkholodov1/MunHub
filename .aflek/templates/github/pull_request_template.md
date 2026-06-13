<!--
  AFLEK template — install as .github/pull_request_template.md
  PLACEHOLDERS: {{PROJECT}}, {{MAINTAINER}}, {{CI_COMMANDS}}, {{REVIEWERS_LINE}} (who/what
  reviews automatically), plus the domain-checklist lines marked "DOMAIN:" — replace them with
  your project's non-negotiables (from the AGENTS.md project-specific guardrails) or delete.
-->
<!-- {{PROJECT}} — Pull Request. Fill every section. PRs that skip this are not reviewable. -->

## Spec & scope
- **Spec:** specs/NNNN-<slug>/spec.md
- **Issue:** #
- **Phase / Epic:**
- **Lane (package(s) touched):**
- **Authoring agent / provider:**

## What changed & why
<!-- One paragraph. What this PR delivers and the reasoning. -->

## Acceptance criteria (copy from the spec, check what is met)
- [ ] CA1:
- [ ] CA2:
- [ ] CA3:

## Tests & evidence
- [ ] Unit/integration tests added or updated
- [ ] `{{CI_COMMANDS}}` green locally
<!-- Paste relevant output / coverage notes. -->

## Self-review checklist
- [ ] All code in **English** (identifiers, comments, commits, i18n keys)
- [ ] **Docs updated** in this PR per the AGENTS.md documentation matrix
- [ ] **Changelog fragment** added in `changelog.d/`
- [ ] This description states **what the change delivers** (no process narration / "as requested" / apologies)
- [ ] Stayed in lane — did **not** edit shared contracts unless this is a contracts spec
- [ ] No `private/` access, no secrets in code or logs
- [ ] DOMAIN: <!-- e.g. data-layer abstraction respected; domain-honesty rule respected -->
- [ ] Feature branch; **not** targeting a direct push to main

## Risks / follow-ups
<!-- Known limitations, anything reviewers should scrutinize, deferred work. -->

---
> Reviewers: {{REVIEWERS_LINE}}. **Only {{MAINTAINER}} merges to `main`.**
