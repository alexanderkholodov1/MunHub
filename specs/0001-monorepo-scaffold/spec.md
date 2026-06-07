# 0001 — Scaffold del monorepo y tooling base

- **Estado:** ✅ implemented (2026-06-07)
- **Agente responsable:** Arquitecto de software
- **Depende de:** D1, D6, D14 (plan maestro); ninguna spec previa
- **Fase:** F1 · **Épica:** EPIC-0 · **Backlog:** S01

> Ejemplo de referencia de Spec-Driven Development. Sigue esta estructura para toda spec nueva
> (plantilla en `planning/03-AGENTS-AND-SDD.md §2`).

## Contexto
La v6.0 se construye como **monorepo** (D6: pnpm + Turborepo) en TypeScript para compartir
tipos/esquema entre web, agente, api y ai, y permitir desarrollo agéntico coordinado. Esta es
la primera spec: sin un esqueleto correcto, nada más puede empezar.

## Requisitos funcionales
- RF1: Workspace pnpm + Turborepo con la estructura de `01-ARCHITECTURE.md §2`
  (`apps/{web,agent}`, `services/{api,ai}`, `packages/{shared,data-provider,ui,physics}`,
  `specs/`, `docs/`, `infra/`, `.github/`).
- RF2: TypeScript estricto, ESLint + Prettier, Vitest configurados a nivel raíz y por paquete.
- RF3: Licencia MIT (D14) en `LICENSE`.
- RF4: `.gitignore` cubre `private/`, `.env*`, `node_modules/`, build outputs.
- RF5: `.env.example` documenta variables necesarias (sin valores reales).
- RF6: Scripts raíz: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` (vía Turbo).

## Requisitos no funcionales
- Builds cacheados por Turborepo (incremental).
- Cada paquete compila aislado; `packages/{shared,physics}` sin dependencias de IO.

## Diseño / enfoque
- `pnpm-workspace.yaml` declara `apps/*`, `services/*`, `packages/*`.
- `turbo.json` define pipelines `build`, `test`, `lint`, `typecheck` con dependencias.
- `tsconfig.base.json` raíz con `strict: true`; cada paquete extiende.
- Paquetes inician como stubs mínimos que compilan (un `index.ts` con un export trivial) para
  validar la tubería; el contenido real llega en sus specs (S03, S04, S05, …).

## Criterios de aceptación (verificables)
- [x] CA1: `pnpm install` instala el workspace sin errores.
- [x] CA2: `pnpm build && pnpm test && pnpm lint && pnpm typecheck` corren verde (12/12 tasks).
- [x] CA3: `private/` y `.env*` verificados como ignorados por git.
- [x] CA4: `LICENSE` (MIT, 2026 Alexander Kholodov) y `.env.example` presentes.
- [x] CA5: estructura `apps/{web,agent}`, `services/{api,ai}`, `packages/{shared,data-provider,ui,physics}`, `infra/`, `specs/`, `docs/` verificada.

## Fuera de alcance
- Lógica real de cualquier paquete (va en sus propias specs).
- CI/CD (es S02, spec aparte).

## Tareas
- [x] T1: `pnpm-workspace.yaml` + `turbo.json` + `tsconfig.base.json` (arquitecto).
- [x] T2: stubs creados y compilando: `packages/{shared,physics,data-provider,ui}`, `apps/{web,agent}`, `services/{api,ai}`.
- [x] T3: ESLint flat config (`eslint.config.mjs`), Prettier (`.prettierrc.json`), Vitest por paquete con `passWithNoTests`.
- [x] T4: `LICENSE` (MIT 2026), `.gitignore` extendido (pnpm/Turbo/Tauri/SQLite), `.env.example`.
- [x] T5: CA1–CA5 verificados. Working tree listo para revisión y commit de Alexander.
