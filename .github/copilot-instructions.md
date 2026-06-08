# GitHub Copilot — MunHub Lab v6.0

**READ `AGENTS.md` at the repository root FIRST (in full).** It is the binding entry contract for
every agent on this project, regardless of provider. This file is a pointer to it.

## Non-negotiable guardrails (authority: `AGENTS.md`)
- **All code in English (D28):** identifiers, comments, commit messages, i18n keys, DB/API names.
- **No code without a spec.** Implement against the assigned spec in `/specs/NNNN-*/`.
- **Stay in your lane.** Edit ONLY the assigned package(s). Never touch the shared contracts
  (`packages/shared`, `packages/data-provider`) — Claude-owned.
- **Scientific honesty.** Never label single-SiPM events as "muons" (use "charged-particle /
  MIP-type rate"). Never contradict `docs/research/THEORETICAL-FOUNDATION.md`.
- **Data integrity.** Averages never sums; no event filtering; validate with `zod`.
- **Provider-agnostic data.** Never call Firebase/Supabase SDK directly — only via `DataProvider`.
- **Secrets.** Never read/print `private/`. Never commit secrets.

## Git policy (D32)
- Feature branch → commit + push → open PR (Conventional Commits, English).
- 🔒 NEVER commit/push to `main`, NEVER merge. Only Alexander merges.
- CI (`build/test/lint/typecheck` + gitleaks) must be green before a PR is mergeable.

## When assigned an Issue (coding agent)
Implement exactly the linked spec, satisfy every acceptance criterion, add tests, open a PR
referencing the spec and Issue. Then stop for review.
