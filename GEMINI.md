# Gemini — MunHub Lab v6.0

**READ `AGENTS.md` FIRST (in full).** It is the binding entry contract for every agent on this
project, regardless of provider. Everything below is a pointer to it.

## Non-negotiable guardrails (summary — the authority is `AGENTS.md`)
- **All code in English (D28):** identifiers, comments, commit messages, i18n keys, DB/API names.
- **No code without a spec.** Implement against the spec in `/specs/NNNN-*/` you were assigned.
- **Stay in your lane.** Edit ONLY the package(s) assigned. Never edit the shared contracts
  (`packages/shared`, `packages/data-provider`) — those are Claude-owned.
- **Scientific honesty.** Never label single-SiPM events as "muons" — use "charged-particle /
  MIP-type rate". Never contradict `docs/research/THEORETICAL-FOUNDATION.md`.
- **Data integrity.** Averages never sums; no event filtering; validate with `zod`.
- **Provider-agnostic data.** Never call Firebase/Supabase SDK directly — only via `DataProvider`.
- **Secrets.** Never read or print anything in `private/`. Never commit secrets.

## Git policy (D32)
- Work on a feature branch; commit + push the branch; open a PR. Conventional Commits, English.
- 🔒 NEVER commit/push to `main`, NEVER merge. Only Alexander merges.
- Before opening a PR: `pnpm build && pnpm test && pnpm lint && pnpm typecheck` must pass.

## Definition of Done
All spec acceptance criteria checked + tests (numeric tests for physics) + CI green + PR opened
with the Stage Report. Then STOP.
