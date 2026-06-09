# Changelog

All notable changes to MunHub Lab are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Every pull request that changes
behavior, structure, or documentation **must add an entry under `[Unreleased]`** (see
[`AGENTS.md`](AGENTS.md), documentation guardrail).

## [Unreleased]

### Added
- Selling, science-forward **README** for the v6 reconstruction.
- **Technical documentation:** `docs/technical/` index, `ARCHITECTURE.md` (with a C4 system-context
  diagram), `DATA-MODEL.md`.
- **Preliminary user manual:** `docs/user-manual/` — the institution → station → detector → session
  mental model and a glossary.
- **Engineering standards** doc: `docs/technical/ENGINEERING-STANDARDS.md` (Clean Architecture,
  SOLID, pragmatic TDD, C4, future-proofing, and the verdicts on evaluated practices).
- This **CHANGELOG**.
- **Design language** "Observatory Dark" (`docs/design/DESIGN-LANGUAGE.md`) and the landing concept.
- **Platform strategy** (`planning/19`): Firebase-max services map and integrations verdict.
- **Decisions** D36–D43 registered in the master plan.

### Changed
- Versioning set to a pre-release scheme: root `package.json` → `6.0.0-alpha.1`.
- Master-plan "golden rule" updated to the D32 branch + PR + protected-`main` workflow.
- `AGENTS.md`: status line refreshed; documentation-update guardrail added.

## [6.0.0-alpha.1] — 2026-06-08

The first tagged checkpoint of the v6 reconstruction: foundations and engineering workflow in place.

### Added
- **Monorepo scaffold** (S01): pnpm + Turborepo, TypeScript strict, ESLint/Prettier/Vitest, eight
  package/app/service stubs that build, MIT `LICENSE`, `.env.example`.
- **CI quality gate** (S02): GitHub Actions running build · test · lint · typecheck plus a
  `gitleaks` secret scan on every pull request.
- **Protected `main`** with required checks; branch + PR workflow (D32).
- **Multi-provider agent fleet** orchestration (`planning/18`): routing, defense-in-depth review,
  per-provider instruction shims, `CODEOWNERS`, PR template, fleet secret loader.

### Notes
- The v5 application remains in `public/` as a historical reference only.

[Unreleased]: https://github.com/alexanderkholodov1/MunHub/commits/main
[6.0.0-alpha.1]: https://github.com/alexanderkholodov1/MunHub/releases/tag/v6.0.0-alpha.1
