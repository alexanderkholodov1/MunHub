# Playbook — bootstrap a new project

> Empty repository → working fleet project in one session. Done when the checklist in step 7
> passes and the first wave is planned.

## Inputs (ask the operator once, up front)

1. Project name, one-paragraph mission, and the **domain non-negotiables** (the truths the
   project must never violate — science, legal, money, safety; these become the
   "project-specific guardrails" section).
2. Stack (or "propose one"), license, public/private.
3. The first vertical slice: the smallest end-to-end behavior that proves the architecture.
4. Provider inventory: which agent surfaces/subscriptions exist (and billing cautions).

## Procedure

1. **Instantiate templates.** From the kit (pin its version in `FLEET-VERSION`):
   `AGENTS.md` (from `AGENTS.template.md`, all placeholders filled), the four shims,
   `CONTRIBUTING.md`, `changelog.d/`, status board, `.github/` (CI, PR template, CODEOWNERS).
2. **Write the foundation docs** before any code: master plan with a **decision log**
   (D-numbered, with rationale — this is the project's most valuable artifact), architecture
   sketch, backlog of specs. Depth scales with the project; the decision log does not get
   skipped.
3. **Commit to `main` while empty**, then immediately protect `main` (PR + CI required) and
   switch to branch+PR discipline.
4. **Stand up CI** so the gate exists before the first feature PR.
5. **Write the vertical-slice spec** and decompose it into work packages (work-package.md).
6. **Adopt personas** relevant to the domain (code/security/silent-failure always; add domain
   reviewers, e.g. a physicist persona for scientific projects).
7. **Verify the bootstrap:**
   - [ ] A fresh agent session, given only the repo, states the current task correctly.
   - [ ] `main` rejects direct pushes; a trivial PR runs CI end-to-end.
   - [ ] Every template placeholder is filled (`rg '\{\{'` returns nothing).
   - [ ] The operator knows their two surfaces: the PR queue and the status board.
8. **Plan wave 1** (run-a-wave.md) and hand the maintainer the launch summary.

## Anti-patterns this playbook exists to prevent

- Code before contracts; breadth before the vertical slice.
- Copying another project's domain guardrails because they "look professional".
- Bootstrapping from a chat: if the session dies after step 2, the repo must already contain
  everything needed to continue.
