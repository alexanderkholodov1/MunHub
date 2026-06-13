# Playbook — phase audit (completeness audit at a phase boundary)

> Run at every phase close, after any chaotic stretch, or when sessions feel like they are
> re-discovering the project. Generalized from the first adopter's 2026-06-12 audit, which
> turned a drifting repo into a self-contained plan of record in one session. Executor:
> the adjutant (orchestrator-grade). Output: ONE self-contained document in the repo.

## Procedure

1. **Open the audit document first** (`docs/audit/YYYY-MM-DD-STATE-OF-PROJECT.md`), with
   its skeleton: executive summary · findings (keep / defects) · research record ·
   decision queue · work packages · sequencing. Write into it as you go — the audit that
   lives only in a chat does not exist (doctrine 6).
2. **Entry-point truth test.** Read `AGENTS.md` and every shim as a brand-new agent would.
   Verify every claim against the repo as it is *now*: do the build commands run? do the
   named directories exist? is the stated policy the latest decision? Every false or
   self-contradictory claim is a defect with file:line evidence.
3. **State reconciliation.** Compare `docs/STATUS.md`, the spec folders, the backlog, and
   the open-PR queue. List every divergence (specs marked open that merged, numbering
   schemes that forked, boards that went stale). *(First adopter: the real phase blocker
   was two foundation PRs sitting unreviewed — visible only once the queue was compared
   to the board.)*
4. **Policy-leak sweep.** Grep issues, templates, wikis, and old docs for superseded
   policies and dead decision numbers still stated as law.
5. **Domain claims check.** Verify the project's load-bearing factual claims (scientific
   numbers, legal statements, performance promises) against sources; soften or pin what
   cannot be cited. Record the fact-checks in the research record so no future session
   repeats them.
6. **Triage every defect** into: *fixed in this audit PR* (entry points, board) · *a
   numbered work package* (WP-NN with files, acceptance, suggested executor) · *a
   maintainer decision* (queued with a recommendation — never an open question without
   one).
7. **Sequence the WPs** (dependencies, parallel groups) and route them per the adapters.
8. **Ship the audit as a PR** that also fixes the entry points and the status board, with
   a Stage Report listing the maintainer's decision queue.

## Done when

- The audit document is in the repo and **self-contained**: a cold session can resume the
  project from it alone, without any chat history.
- Entry points pass the truth test (re-run docs-auditor Mode B clean, or with only
  WP-tracked findings).
- Every defect is fixed, packaged as a WP, or queued as a maintainer decision with a
  recommendation — zero unowned findings.
- `docs/STATUS.md` reflects reality, including the open-PR queue.
