# 0001 — Scaffold del monorepo y tooling base

- **Estado:** approved
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
- [ ] CA1: `pnpm install` instala el workspace sin errores.
- [ ] CA2: `pnpm build && pnpm test && pnpm lint && pnpm typecheck` corren verde.
- [ ] CA3: `git status` no muestra `private/` ni `.env` (están ignorados).
- [ ] CA4: existe `LICENSE` (MIT) y `.env.example`.
- [ ] CA5: la estructura de carpetas coincide con `01-ARCHITECTURE.md §2`.

## Fuera de alcance
- Lógica real de cualquier paquete (va en sus propias specs).
- CI/CD (es S02, spec aparte).

## Tareas
- [ ] T1: `pnpm-workspace.yaml` + `turbo.json` + `tsconfig.base.json` (arquitecto).
- [ ] T2: crear los paquetes/apps como stubs que compilan (arquitecto).
- [ ] T3: ESLint/Prettier/Vitest base (arquitecto).
- [ ] T4: `LICENSE` (MIT), `.gitignore`, `.env.example` (arquitecto).
- [ ] T5: verificar CA1–CA5; dejar listo para commit humano.
