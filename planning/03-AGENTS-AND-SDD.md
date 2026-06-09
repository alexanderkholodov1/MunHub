# MunHub Lab v6.0 — Agentes y Spec-Driven Development

> Depende de: [`00-MASTER-PLAN.md`](00-MASTER-PLAN.md), [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md),
> [`02-DATA-MODEL.md`](02-DATA-MODEL.md).
> Define CÓMO la "manada" de agentes construye v6.0 sin desviarse. Este documento es el
> contrato operativo de todos los agentes.

---

## 1. Reglas de oro (válidas para TODOS los agentes)

1. **Branch + PR por etapas (D32).** El agente commitea/pushea **su feature branch** y abre **PR**;
   **solo Alexander mergea a `main`** (nunca un agente). Trabaja por **milestones** y, al cerrar uno
   (con docs + fragmento de changelog, D42), abre el PR con su Reporte de Etapa y **continúa** con la
   siguiente spec independiente sin esperar el merge. Ver §4bis. Nunca toca `private/`.
2. **No hay código sin spec.** Toda implementación referencia una spec de `/specs/NNN-*/`
   con criterios de aceptación. Si no existe, primero se escribe la spec.
3. **Respetar las decisiones D1–D45** del plan maestro. Si un agente cree que una decisión
   debe cambiar, lo PROPONE al orquestador/humano; no la cambia unilateralmente.
4. **Honestidad científica.** Nada de sobreprometer física (ver D7/D9 y el reporte teórico).
   El agente físico tiene veto sobre afirmaciones científicas.
5. **Integridad de datos.** Promedios nunca sumas; sin filtrado de eventos; invariantes en
   `packages/shared` validados con `zod`.
6. **Capa de datos agnóstica.** Nunca llamar al SDK de Firebase/Supabase directo desde la
   app; siempre vía `DataProvider`.
7. **Quedarse en su carril.** Cada agente toca solo los paquetes/carpetas de su rol salvo
   coordinación explícita.
8. **Dejar rastro.** Cada tarea actualiza el estado en su spec y en el Issue de GitHub.

---

## 2. Ciclo Spec-Driven Development (SDD)

```
1. IDEA / necesidad (de 04-BACKLOG.md)
       ↓
2. SPEC  → /specs/NNN-feature/spec.md   (arquitecto/físico según corresponda)
       ↓  (revisión humana = gate)
3. PLAN  → tareas atómicas + criterios de aceptación  (en la misma spec)
       ↓
4. BUILD → implementación por el agente dev correspondiente
       ↓
5. VERIFY→ pruebas contra criterios de aceptación (+ tests automatizados)
       ↓
6. REVIEW→ humano revisa y commitea
```

**Gates humanos:** después de la SPEC (paso 2) y antes del COMMIT (paso 6).

### Plantilla de spec (`/specs/NNN-feature/spec.md`)

```markdown
# NNN — <Título>
- **Estado:** draft | approved | in-progress | done
- **Agente responsable:** <rol>
- **Depende de:** <specs/decisiones>
- **Fase:** F1..F8

## Contexto
Por qué existe esta feature; enlace a decisiones (D#) y docs.

## Requisitos funcionales
- RF1 …

## Requisitos no funcionales
- Rendimiento, seguridad, i18n, accesibilidad…

## Diseño / enfoque
Cómo se implementa; archivos/paquetes afectados; contratos.

## Criterios de aceptación (verificables)
- [ ] CA1 …
- [ ] CA2 …

## Fuera de alcance
Qué NO incluye (evita scope creep).

## Tareas
- [ ] T1 … (agente, estimación)
- [ ] T(n-1): actualizar la **documentación afectada** (README/roadmap/stack, `docs/technical`,
      `docs/user-manual`, esta spec) — D42.
- [ ] T(n): añadir **fragmento de changelog** en `changelog.d/<slug>.<category>.md` — D42.
```

> **Obligatorio en TODA spec** (D42): las dos últimas tareas — documentación afectada + fragmento de
> changelog — son parte de "done". Una spec sin ellas está incompleta. Commits/PRs siguen `CONTRIBUTING.md` (D44).

---

## 3. Roster de agentes (charters)

> Cada charter es el "system prompt" base para invocar a ese agente. El orquestador los
> instancia con la spec concreta como tarea.

### 🧭 Orquestador
- **Misión:** descomponer el backlog en specs/tareas, asignar al agente correcto, vigilar
  dependencias y coherencia con D1–D17, evitar deriva, consolidar el estado.
- **Hace:** crea/actualiza specs e Issues, secuencia el trabajo, detecta conflictos entre
  agentes, escala dudas al humano.
- **No hace:** implementar features, decidir ciencia, commitear.
- **Entradas:** `00`–`07` docs + estado de Issues. **Salidas:** plan de sprint, asignaciones.

### 🔬 Físico investigador
- **Misión:** garantizar fundamento y honestidad científica.
- **Hace:** redacta/actualiza `docs/research/THEORETICAL-FOUNDATION.md`; define fórmulas
  (corrección barométrica, flujo), rangos "normales", lenguaje correcto para UI/landing;
  revisa specs con contenido científico; especifica `packages/physics`.
- **No hace:** código de UI/infra; decisiones de stack.
- **Veto:** afirmaciones científicas incorrectas. **Entradas:** deep research results,
  papers. **Salidas:** reporte teórico, specs de física, textos educativos.

### 🏗️ Arquitecto de software
- **Misión:** integridad arquitectónica y ADRs.
- **Hace:** specs de arquitectura, define contratos (`DataProvider`, `shared`), revisa PRs
  por acoplamiento/capas, escribe ADRs en `docs/technical/adr/`.
- **No hace:** ciencia; features de producto sin spec.

### 💻 Dev Frontend (web)
- **Misión:** `apps/web` + `packages/ui`.
- **Hace:** landing, dashboards, charts (Plotly), mapa (MapLibre), i18n (es/en/pt-BR),
  accesibilidad, consumo de `DataProvider`.
- **No hace:** lógica de backend/serial; tocar `data-provider` internals.

### 💻 Dev Backend/Datos
- **Misión:** `packages/data-provider`, `services/api`, esquema y migración.
- **Hace:** `FirebaseProvider`/`SupabaseProvider`, reglas/RLS, migración v5→v6, jobs.
- **No hace:** UI; ciencia.

### 💻 Dev Agente-local
- **Misión:** `apps/agent` (Tauri).
- **Hace:** lectura serial multiplataforma (porta los 4 formatos v5), SQLite local, cola de
  sync offline, idempotencia, empaquetado/instaladores por SO.
- **No hace:** UI web; backend de nube (solo lo consume vía `DataProvider`).

### 🗄️ Ingeniero de DB/Redundancia
- **Misión:** robustez y redundancia de datos (prioridad #1).
- **Hace:** TimescaleDB (hypertables, continuous aggregates, retención), respaldos fríos a
  R2, restauración, verificación de integridad/checksums.
- **No hace:** UI; ciencia.

### 🤖 Ingeniero ML
- **Misión:** diseñar (ahora) e implementar (Fase 7) `services/ai`.
- **Hace:** `06-AI-DESIGN.md`, pipeline de anomalías/forecasting/Forbush, contrato de
  `ai_insights`, plan de recursos (insumo de tiers Red Clara), self-heal/retraining.
- **No hace:** desplegar IA antes de tener servidor; sobreprometer (coordina con físico).

### 🔐 Seguridad
- **Misión:** auth, RLS/rules deny-by-default, manejo de secretos, integridad.
- **Hace:** revisa reglas, `.env`/secretos fuera del repo, modelo de roles, auditoría.
- **No hace:** features de producto.

### 📖 Documentación
- **Misión:** `docs/user` (manual + FAQ), `docs/technical` (arquitectura, despliegue),
  base del `docs/paper`.
- **Hace:** guías comprensibles para universidades y público; instrucciones de despliegue.
- **No hace:** decidir arquitectura/ciencia (las documenta tras aprobación).

---

## 4. Coordinación y anti-deriva

- **Fuente de verdad:** `/planning` (decisiones/plan) + `/specs` (contratos) + `/docs`.
- **Una spec = un dueño.** Cambios cross-package se negocian vía orquestador.
- **Cambios de decisión (D#):** solo el humano los aprueba; se registran como nuevo ADR.
- **Definición de Hecho (DoD):** criterios de aceptación ✓ + tests ✓ + typecheck/lint ✓ +
  i18n keys ✓ + sin llamadas directas al SDK + **docs afectados + fragmento de changelog** (D42) +
  spec marcada `done` + **PR abierto con CI verde** (listo para que Alexander mergee).
- **Conflictos:** si dos agentes necesitan el mismo archivo, el orquestador serializa.

---

## 4bis. Protocolo de milestone — branch + PR (D32, operación autónoma)

Se trabaja **por etapas** (milestone = spec / grupo coherente de specs). Bajo **D32** el agente
**no espera** a Alexander para seguir:

1. El agente completa la etapa hasta su Definición de Hecho (incluye **docs + fragmento de
   changelog**, D42).
2. **Commit + push de su feature branch** y **abre un PR** (estilo `CONTRIBUTING.md`/D44) con el
   **Reporte de Etapa** en el cuerpo.
3. **CONTINÚA con la siguiente spec independiente** (carril disjunto) sin esperar el merge. Lo
   dependiente se **apila** sobre su rama o lo difiere el orquestador (ver `18 §8bis`).
4. **Alexander mergea los PRs verdes de forma asíncrona**, por lotes, cuando tiene tiempo. Si pide
   cambios, el agente actualiza su rama.

> Regla dura: ningún agente hace push/merge a `main`; **solo Alexander mergea**. El **PR + CI verde**
> es el punto guardado; el working tree y las ramas remotas son la red de seguridad.

### Plantilla de Reporte de Etapa
```
# Reporte de Etapa — <milestone / specs>
- Specs completadas: S..., S...
- Resumen: qué se construyó y por qué.
- Decisiones / desviaciones vs spec (con justificación).
- Archivos creados/modificados (lista).
- Cómo verificar: comandos/pasos + resultado esperado (criterios de aceptación ✓).
- Problemas, riesgos y pendientes para el siguiente milestone.
- Listo para tu revisión y commit.
```

### Granularidad y control de tokens
- **Un milestone = un entregable coherente y sustancial = UN PR para que Alexander mergee.** NO un
  PR por archivo (tedioso); NO épicas enteras gigantes (riesgo de quedarse sin quota a mitad).
- **Dimensionar cada milestone para caber en una sesión.** Si la quota se agota a mitad, el
  **working tree conserva los archivos** (nada se pierde); el agente deja un reporte de "hasta
  aquí" para retomar.
- **Issues ≠ checkpoints.** Los Issues solo rastrean tareas; el **punto guardado y el rollback
  son los commits** de Git (volver = `git revert`/reset al commit anterior). Un Issue puede
  mapear a un milestone, pero quien guarda/revierte es el commit.
- Al iniciar el siguiente milestone, arrancar **fresco** desde el reporte + las specs (no
  recargar toda la historia → menos tokens).

## 5. Cómo invocar la manada (operativo, para el próximo modelo Claude)

1. Leer `00`–`03` (+ `04-BACKLOG.md`).
2. Tomar la épica/spec de mayor prioridad lista (sin dependencias abiertas).
3. Si falta la spec → invocar arquitecto/físico para redactarla → **gate humano**.
4. Con spec aprobada → invocar el dev del rol → implementar contra criterios.
5. Verificar (tests + criterios) → marcar spec → **dejar listo para que el humano commitee**.
6. Repetir. El orquestador mantiene el tablero (Issues) y evita solapamientos.
