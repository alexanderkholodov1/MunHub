# MunHub Lab v6.0 — Orquestación de flota de agentes multi-proveedor

> Depende de: `00-MASTER-PLAN.md`, `03-AGENTS-AND-SDD.md` (SDD + gates), `AGENTS.md` (brief universal).
> Objetivo: **maximizar throughput y ahorrar quota de Claude** repartiendo el trabajo entre
> varios proveedores (Claude, Gemini, Cursor, GitHub Copilot) **sin sacrificar calidad ni
> integridad científica**, y usando a la propia flota para **verificar la calidad de cada paso,
> cada etapa y la completitud del producto final**.
>
> **Principio rector:** la aceleración NO viene de "muchos agentes en el mismo archivo", viene de
> **paralelismo asíncrono sobre specs aislados** una vez que existen los **contratos**, con
> **verificación en profundidad** (defense-in-depth) en cada PR y en cada fase. El spec es el
> paquete de contexto; el worktree es el carril; el contrato es el punto de sincronización;
> **el PR + CI + revisión cruzada es la red de calidad.**

---

## 1. Realidad verificada (qué hay disponible HOY)

| Recurso | Estado | Invocación real | Quota/costo |
|---|---|---|---|
| **Claude Opus** (esta sesión) | ✅ | Orquestador/arquitecto/revisor | quota Claude (cara) |
| **Claude Sonnet** | ✅ | Implementador vía `Agent` tool / sesión propia | quota Claude (media) |
| **Claude Haiku** | ✅ | Subagente vía `Agent` tool (`model: haiku`) | quota Claude (barata) |
| **Gemini CLI** `0.39.1` | ✅ instalado | `gemini -p "…"` no-interactivo, o sesión en worktree | API key (gratis/generosa) |
| **GitHub `gh`** `2.93.0` | ✅ authed `alexanderkholodov1` | scopes `repo`,`workflow` → PRs, Issues, protección, Actions | — |
| **Copilot coding agent** | ✅ viable (gh authed) | Asignar Issue → PR asíncrono | Education |
| **Copilot code review** | ✅ | Revisión automática en PRs | Education |
| **Cursor Pro** (1 mes) | ✅ instalado | Background Agents (cloud→PR), Bugbot (review), Agent mode (IDE) | Pro, **caduca en ~1 mes** |
| Keys en `private/` | ✅ | `Gemini API Key`, `Cursor API Key`, `GitHub PAT` (NUNCA leídas/impresas) | — |

> **Honestidad sobre los límites (no sobre-prometer):**
> - **Claude no "comanda" a Cursor/Copilot en tiempo real.** El modelo realista: yo **preparo
>   unidades de trabajo** (spec + Issue + branch) que **cualquier** agente ejecuta; yo **reviso e
>   integro**. Cursor/Copilot trabajan en su propia infra (cloud) o en el asiento de Alexander.
> - **Gemini CLI y subagentes Claude SÍ son orquestables** programáticamente desde aquí.
> - El costo de coordinación es real: lo que lo hace rentable es **specs buenos + carriles por
>   paquete + worktrees + gates de CI + revisión cruzada automática**.

---

## 2. Arquitectura por capas

```
L0  HUMANO (Alexander)
      → aprueba specs, hace MERGE a main (último gate), autoridad final.

L1  ORQUESTADOR  (Claude Opus — "tech lead")
      → mantiene backlog, ESCRIBE/refina specs, define CONTRATOS, crea Issues, asigna por la
        matriz de ruteo, REVISA, integra ramas, resuelve conflictos. No delega contratos ni
        honestidad científica.

L2  IMPLEMENTADORES (la flota)  — un spec en un worktree, una rama, un PR
      ├─ Claude Sonnet   → specs críticos/complejos (provider, migración, seguridad)
      ├─ Claude Haiku    → mecánico/bulk con contexto del repo
      ├─ Gemini CLI      → specs aislados, bien specceados, con tests (física, docs, bulk)
      ├─ Cursor BG Agent → olas paralelas (UI y specs aislados) → PR (1 mes, front-load)
      ├─ Cursor (Alex)   → trabajo visual/interactivo/exploratorio
      └─ Copilot agent   → Issues leaf aislados → PR asíncrono

L3  REVISORES (gate de calidad — ver §6)
      ├─ Automáticos por PR: CI, Cursor Bugbot, Copilot review, secret-scan, coverage
      ├─ Personas Claude:    Físico (vs THEORETICAL-FOUNDATION), Seguridad, Arquitecto
      └─ Cruzados:           el autor NUNCA es el único revisor; revisa un proveedor distinto
```

**Regla de oro:** **contratos** (`packages/shared` tipos+zod, `packages/data-provider` interface)
y **corrección científica/seguridad** SOLO los toca Claude (Opus diseña → Sonnet implementa → L3
revisa). Los agentes "hoja" construyen *contra* esos contratos, nunca los editan.

---

## 3. Matriz de ruteo (qué tarea va a qué agente)

| Arquetipo | Ejemplos (specs) | Implementa | Revisa (además de CI+Bugbot+Copilot) |
|---|---|---|---|
| **Contratos / arquitectura** | S03 tipos, S04 interface, S05 zod | Opus diseña → **Sonnet** | Opus |
| **Lógica pura con spec+tests** | S06 física (dead-time, β, flux, Landau) | **Gemini** o Sonnet | **Físico (L3)** |
| **Provider / SDK / seguridad** | S08 FirebaseProvider, reglas DB | **Sonnet** | Opus + **Seguridad** |
| **Migración / integridad** | S07 (dump 1GB → v6) | **Sonnet** | Opus + Físico |
| **UI / componentes / charts** | S13 charts, S11 dashboard, forms | **Cursor (Alex/BG)** + Copilot | Opus (spot) |
| **Scaffold de app** | S09 Next.js, S16 Tauri | **Sonnet** o Cursor | Opus |
| **Mecánico / bulk** | moves, test scaffolds, i18n keys | **Haiku** o Gemini | spot-check |
| **Docs largos / traducción** | manual, docs técnicos, es/pt-BR | **Gemini** | Claude |
| **Issues leaf asíncronos** | features aisladas bien specceadas | **Copilot agent** | Opus (PR) |

### Función de decisión (cómo ruteo cada spec)
1. ¿Toca contratos de `shared` o corrección física/seguridad? → **Claude** (jamás agente hoja).
2. ¿Completamente specceado + paquete aislado + con criterios/tests? → elegible **Gemini/Cursor/Copilot/Haiku**.
3. ¿Mecánico, voluminoso, bajo riesgo? → **Haiku/Gemini**.
4. ¿Visual, iterativo, exploratorio? → **Cursor**.
5. Ambiguo o por defecto → **Claude Sonnet**.

### Estrategia de quota
- **Reservar Claude (esp. Opus)** para arquitectura, contratos, gates de revisión, integración, ambiguo/crítico.
- **Gemini** = caballo de batalla de volumen (gratis/generoso): impl. aislada, docs, traducción, bulk.
- **Cursor (1 mes)** = front-load olas pesadas + Bugbot en TODOS los PRs durante la ventana.
- **Copilot** = Issues leaf asíncronos + segunda revisión automática. Cero quota Claude.
- **Haiku** = mecánico dentro de Claude que aún necesita contexto del repo.

---

## 4. Cursor Pro — exprimir la ventana de 1 mes

Caduca en ~1 mes → **front-load** lo más valioso DENTRO de la ventana, luego cae a free.

1. **Bugbot (revisión automática de PRs):** habilitarlo en el repo el primer día. Escanea
   **cada PR** buscando bugs, regresiones y problemas — encaja perfecto con "verificar la calidad
   de cada paso". Es revisión gratis y continua durante todo el mes.
2. **Background Agents (cloud → PR):** lanzar agentes async que trabajan specs aislados en su
   entorno y abren PR. Úsalos como **implementador paralelo extra** en olas de UI y specs hoja.
   Programar las olas más grandes durante el mes.
3. **Agent mode (IDE):** asiento interactivo de Alexander para trabajo visual/exploratorio
   (dashboards, ajustes finos) donde el humano-en-el-lazo rinde más.
4. **Plan de ventana:** concentrar la mayor implementación paralela + la revisión Bugbot en el
   mes; tras caducar → fallback a Gemini + Claude + Copilot review.

---

## 5. Copilot (Education) — async + segunda opinión

1. **Coding agent (Issue → PR):** asignar Issues *leaf* bien specceados a `@copilot`; trabaja en
   rama y abre PR. Ideal para CRUD/boilerplate aislado. Disparable ya (gh authed).
2. **Copilot code review:** pedir revisión de Copilot en PRs — complementa a Bugbot (dos
   revisores automáticos de distinto proveedor = más cobertura de puntos ciegos).
3. **VS Code Copilot:** asistente inline de Alexander.

---

## 6. Sistema de verificación de calidad (defense-in-depth) — el corazón

> Meta de Alexander: usar la flota para **verificar la calidad de cada paso, cada etapa y la
> completitud final**. La calidad NO depende de que el humano revise todo a mano: la dan **capas
> automáticas + revisión cruzada + auditorías de fase**.

### Capa A — Automática, en CADA PR (sin humano, sin quota Claude)
- **CI (S02):** `build · test · lint · typecheck` en GitHub Actions. Sin verde → no mergeable.
- **Cobertura de tests:** umbral por paquete (sugerido `shared/physics/data-provider ≥ 80%`); el
  PR falla si baja. La física exige **tests numéricos** contra valores conocidos del foundation.
- **Tipos estrictos:** `any` prohibido (eslint), `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- **Secret-scan:** `gitleaks` en CI → ninguna key se filtra (defensa extra sobre `.gitignore`).
- **Cursor Bugbot** + **Copilot review:** dos revisores automáticos de distinto proveedor por PR.
- **Spec-conformance:** el PR debe referenciar su spec y marcar sus criterios de aceptación (CA).

### Capa B — Revisión cruzada multi-proveedor (la idea clave)
- **El autor NUNCA es el único revisor**, e idealmente revisa **un proveedor distinto**: cada
  modelo tiene puntos ciegos diferentes → el *ensemble* atrapa más que el auto-review.
- Ej.: Gemini implementa S06 → revisan **Claude (Físico)** + Bugbot + Copilot.
  Claude implementa contratos S03 → **Gemini** sanea ergonomía de API + **Opus** firma.

### Capa C — Personas Claude especializadas (L3), en PRs relevantes
- **Físico:** nomenclatura ("partículas cargadas/tipo-MIP", no "muones" en 1 SiPM), fórmulas de
  corrección, β local, restricción de Poisson, tiempo muerto. Veto si contradice el foundation.
- **Seguridad:** deny-by-default, sin SDK directo (frontera `data-provider`), secretos, zod.
- **Arquitecto (Opus):** integridad de contratos, fronteras de paquete, sin deriva arquitectónica.

### Capa D — Humano (Alexander)
- Revisión final del PR con TODO el contexto (diff + CI + Bugbot + Copilot + review Claude) y
  **merge a `main`**. Es la última firma, sobre un PR revisable — no sobre un teclado.

### Calidad a nivel de ETAPA y de PRODUCTO (más allá del PR)
- **Definition of Done (DoD) por spec:** CA cumplidos + tests + docs + revisado + CI verde.
- **Gate de fase:** al cerrar F1, F2… una **auditoría de completitud** comprueba que la fase
  entrega sus specs y corre el **E2E del corte vertical MVP** (AGENTS.md): estación+detector →
  agente → provider → dashboard con tasa corregida + espectro en vivo.
- **Auditor de completitud (agente dedicado):** cruza backlog (S01–S73) vs. specs implementados
  vs. aceptación; marca huecos, código muerto, tests faltantes, docs obsoletos → **reporte de
  completitud del producto**. Corre al cierre de cada fase.
- **Regresión:** los tests se acumulan; CI corre la suite completa en cada PR.

### Visibilidad / métricas
- `docs/STATUS.md` (o el Project board) como tablero: % CI verde, cobertura, hallazgos abiertos,
  cobertura de specs (X/73), checklist del MVP. Actualizado por el orquestador en cada ola.

---

## 7. Coordinación: cómo no se pisan (operación de la manada)

1. **`AGENTS.md` = brief universal.** Shims por proveedor → todos apuntan ahí:
   `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/00-agents.mdc`.
   Mismos guardrails para todos (D28 inglés, sin SDK directo, honestidad científica, zod, no tocar contratos ajenos ni `private/`).
2. **Spec = unidad de trabajo.** Un agente, un spec, con CA. Sin spec → primero se escribe (Claude) → gate.
3. **GitHub Issues = cola.** Labels: `agent:{claude-sonnet|gemini|cursor|copilot}`, `lane:{shared|physics|web|agent|api}`, `gate:{physics|security}`, `phase:F1..`, `status:*`.
4. **Branch = `spec/NNNN-slug`; un PR por spec/milestone.** Worktree por tarea → aislamiento físico.
5. **Paquetes = carriles.** Un agente edita SOLO su(s) paquete(s). Contratos editados por UN dueño y **congelados** durante una ola de fan-out. `CODEOWNERS` enruta revisión obligatoria.
6. **Schedule contratos-primero.** `S03`/`S04`/`S05` aterrizan ANTES de paralelizar lo dependiente.
7. **Cadencia de olas.** El orquestador lanza una ola de 3–5 specs de carriles disjuntos →
   recoge PRs → revisión cruzada → Alexander mergea por lotes → siguiente ola.
8. **Plantilla de PR** (obliga al autor a dar el contexto de revisión): spec ref, checklist de CA,
   evidencia de tests, auto-review, riesgos.

---

## 8. Política de commits y push — D32 (BLOQUEADA)

> Decisión adoptada: **feature-branch + Pull Request + CI, con `main` protegido.** Más eficiente
> y más segura que el tecleo manual (el control se mueve de "el humano teclea todo" a "gates
> automáticos + `main` protegido + el humano es el único que mergea").

- ✅ Agentes: **commit + push a feature branches** (`spec/NNNN-*`) + **abrir PR** + Reporte de Etapa.
- ✅ **CI verde obligatorio** para que un PR sea mergeable (revisores automáticos incluidos).
- ✅ **Solo Alexander mergea a `main`** (último gate, sobre un PR rico en señales).
- 🔒 Agentes: **nunca** push a `main`, **nunca** merge, **nunca** tocar `private/`.
- 🔒 **Token de flota** = PAT fine-grained con `contents:write` + `pull-requests:write`, **sin**
  bypass de protección → la regla es **técnica**, no solo de confianza. (El token `gh` actual de
  Alexander, con `repo`+`workflow`, queda para setup/admin: workflows y protección de `main`.)
- ✅ Commits: **Conventional Commits en inglés** (D28) + trailer que identifica al agente/proveedor.

---

## 9. Tiering dentro de Claude (Haiku / Sonnet / Opus)

| Modelo | Cuándo | Ejemplos |
|---|---|---|
| **Opus** | Arquitectura, contratos, decisiones, revisión final, integración | Diseñar S03/S04, revisar S07/S08 |
| **Sonnet** | Implementación de specs no triviales | S06, S07, S08, S09 |
| **Haiku** | Mecánico, determinista, alto volumen, con contexto del repo | moves, stubs de test, i18n keys, formateo |

Mecanismo: subagentes vía `Agent` tool con `model` override + `isolation: "worktree"`.

---

## 10. Seguridad y secretos (innegociable)
- Keys en `private/` (gitignored). Para la flota: **`private/.env.fleet`** (gitignored) exporta
  `GEMINI_API_KEY`, `CURSOR_API_KEY`, `GITHUB_PAT`. Cada runner hace `source` local. Nunca impreso/commiteado.
- Todo agente lee `AGENTS.md` (incluye: no tocar `private/`, no imprimir secretos, inglés D28, sin SDK directo, honestidad científica, zod).
- **gitleaks** en CI como red final. `main` protegido. Token de flota sin bypass.

---

## 11. Rollout por fases

**Fase 0 — Red de seguridad (ANTES de soltar la flota):**
- **S02:** workflow GitHub Actions (`build/test/lint/typecheck` + coverage + gitleaks) en cada PR.
- **Protección de `main`:** exigir PR + checks verdes, prohibir push directo (vía `gh`/API o consola).
- **Shims** de proveedor + **PR template** + **CODEOWNERS** + labels.
- **Bugbot** (Cursor) habilitado en el repo. `private/.env.fleet` creado.

**Fase 1 — Primer paralelo (Claude + Gemini, ya elegido):**
- Claude (Opus→Sonnet) → **S03 contratos** (PR).  ∥  Gemini → **S06 física** (PR, worktree).
- Revisión cruzada (Bugbot + Copilot + Físico) → Alexander mergea. **Meta: validar el lazo completo.**

**Fase 2 — Asincronía total:**
- Copilot coding agent sobre Issues leaf. Cursor Background Agents en olas de UI. 3–5 PRs en vuelo.

**Fase 3 — Régimen permanente + auditorías:**
- Olas continuas; auditor de completitud al cierre de cada fase; E2E del MVP; `docs/STATUS.md` vivo.

---

## 12. Decisiones registradas
- **D32 — Commits/push (BLOQUEADA):** feature-branch + PR + CI, `main` protegido; agentes
  commitean/pushean ramas y abren PR; **solo Alexander mergea**; token de flota sin bypass.
- **D33 — Flota multi-proveedor:** Opus orquesta e integra; ruteo por §3; `AGENTS.md` universal con
  shims; spec=unidad; worktree+paquete=carril; contratos-primero; olas de carriles disjuntos.
- **D34 — Calidad defense-in-depth:** gates automáticos por PR (CI+coverage+gitleaks+Bugbot+Copilot)
  + DoD por spec + gate de fase + auditor de completitud + E2E del MVP.
- **D35 — Revisión cruzada:** el autor nunca es el único revisor; revisa un proveedor distinto;
  personas Claude (Físico/Seguridad/Arquitecto) en PRs relevantes.

> Pendiente reflejar D32–D35 en `00-MASTER-PLAN.md` tras aprobación.

---

## 13. Próximas acciones (Fase 0, tras aprobación)
1. Crear shims (`GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/00-agents.mdc`), `PR template`, `CODEOWNERS`, labels.
2. Escribir spec **S02 (CI/CD)** + workflow Actions (build/test/lint/typecheck + coverage + gitleaks).
3. Activar protección de `main` (pasos exactos para Alexander o vía `gh`/API).
4. Habilitar Bugbot; crear `private/.env.fleet`; actualizar `AGENTS.md` §guardrails con D32 + memoria de usuario.
5. Lanzar **Fase 1**: Claude→S03 contratos; Gemini→S06 física (worktree); revisión cruzada; Reporte de Etapa.
