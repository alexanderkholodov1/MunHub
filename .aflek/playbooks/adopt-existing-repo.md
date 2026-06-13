# Playbook — adopt AFLEK in an existing repository

> Retrofit, not greenfield (for an empty repo use `bootstrap-new-project.md`). The worked
> example throughout is the kit's first adopter, a public scientific monorepo that
> adopted the kit after a project audit found entry-point drift, a stale issue queue, and
> a local-execution fleet design. Time budget: under an hour of orchestrator work + one
> maintainer review pass.

## Procedure

1. **Audit first.** Run `phase-audit.md` (or at minimum its entry-point truth test) on the
   repo as it is. You cannot retrofit a contract onto entry points that lie. *(First adopter: the
   audit found `CLAUDE.md` describing a dead architecture and a Spanish `AGENTS.md`
   contradicting itself on commit policy — both had to be fixed before adoption meant
   anything.)*
2. **Pin the kit.** Copy `FLEET-VERSION` from the kit tag you are adopting into the repo
   root. Record the adoption in the repo's decision log if it has one.
3. **Instantiate the canonical contract.** Fill `templates/AGENTS.template.md` →
   `AGENTS.md`. The two-layer rule (FD5): structural rules come from the template; the
   repo's domain truth goes ONLY in the "project-specific guardrails" section. *(First adopter:
   scientific honesty, averages-not-sums, provider-agnostic data layer.)*
4. **Instantiate the four shims** from `templates/shims/` (`CLAUDE.md`, `GEMINI.md`,
   `.cursor/rules/00-agents.mdc`, `.github/copilot-instructions.md`). If the repo already
   has any of these, **reconcile, don't duplicate**: the existing file's true content moves
   into `AGENTS.md` or the shim's ops-notes section; contradictions resolve in favor of the
   newest recorded decision.
5. **Install the gates.** `templates/github/ci.template.yml` (swap the stack block),
   PR template, CODEOWNERS, `CONTRIBUTING.template.md`, `changelog.d/` pattern,
   `STATUS.template.md` → `docs/STATUS.md`. Protect `main`: PR required, no force-push,
   secret scan + CI as required checks.
6. **Sweep the stale-policy surfaces.** Old issues, READMEs, wikis, and templates that
   embed superseded process rules now contradict `AGENTS.md`. Close/re-issue or edit them
   — agents read issues as law. *(First adopter: sixteen issues carried a dead "agents never
   commit" policy.)*
7. **Install personas and adapters.** Copy the `personas/` you will use into the harness's
   agent directory (e.g. `.claude/agents/`), fill each "project specializations" footer;
   wire the review ensemble (two automated reviewers, different provider than the author).
8. **Run a probe wave.** One small real WP through the full loop (`run-a-wave.md`):
   issue/WP → cloud worker → PR → review ensemble → maintainer merge → STATUS update.
   Fix whatever friction the probe exposes before scaling up.

## Done when

- `FLEET-VERSION` exists; `AGENTS.md` + all four shims are instantiated, consistent, and
  pass the docs-auditor entry-point truth test.
- CI + secret scan are required checks on protected `main`.
- `docs/STATUS.md` is live and lists the probe wave.
- One probe WP has gone WP → PR → merge end-to-end.
- No surface in the repo still states a superseded process policy.
