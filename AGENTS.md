# AGENTS.md — Punto de entrada para agentes (START HERE)

> Si eres un agente (o un modelo Claude) retomando el trabajo de MunHub v6.0: **lee este
> archivo primero, completo, antes de tocar nada.** Es el contrato de arranque.

---

## Qué es esto

**MunHub Lab v6.0** = reconstrucción completa de una plataforma web para adquisición,
almacenamiento, visualización y análisis de datos de detectores de rayos cósmicos
(CosmicWatch / muones), pensada como red internacional multi-universidad en Latinoamérica.

**Estado actual:** 📋 **Planificación COMPLETA. Implementación NO iniciada.** El código v5.0
(Vanilla JS + Firebase) sigue en `public/` como referencia histórica; la v6.0 se construye
nueva (monorepo). No edites `public/` salvo para consultar comportamiento probado.

**Vocabulario clave (D21):** **Estación** = el perfil/sitio registrado (ubicación, metadatos,
visibilidad; lo del mapa). **Detector** = el dispositivo físico CosmicWatch dentro de una
estación (device token, calibración, firmware). Los datos van **por detector**. "Detector"
SIEMPRE = aparato físico; nunca lo uses para el perfil.

---

## Orden de lectura obligatorio

1. `planning/00-MASTER-PLAN.md` — visión, las 17 decisiones (D1–D17), fases, índice.
2. `planning/01-ARCHITECTURE.md` — arquitectura, capa de datos agnóstica, principios.
3. `planning/02-DATA-MODEL.md` — esquema, metadatos, migración v5→v6.
4. `planning/03-AGENTS-AND-SDD.md` — tu rol, el ciclo Spec-Driven, plantilla de spec.
5. `planning/04-BACKLOG.md` — épicas → 49 specs (S01–S49) con criterios de aceptación.
6. `docs/research/THEORETICAL-FOUNDATION.md` — **base científica oficial** (no la contradigas).
7. Según tu tarea: `05` (seguridad), `06` (IA), `07` (APIs externas), `08` (riesgos),
   `09` (ciclo de vida del detector), `10` (operación/gobernanza), `11` (permisos/roles),
   `12` (soporte/notificaciones), `13` (monetización/entitlements), `14` (redes de estaciones),
   `15` (consola admin), `RED-CLARA-RESOURCE-TIERS.md`.

---

## Guardrails (innegociables)

1. **Commits/push por etapas — política D32 (ver `planning/18-AGENT-FLEET-ORCHESTRATION.md`).**
   Trabaja en una **feature branch** (`spec/NNNN-*`, `chore/*`, `feat/*`), un worktree por tarea.
   Al cerrar un **milestone**: `commit` (Conventional Commits **en inglés**, D28, + trailer de
   agente) + `push` de **tu rama** + abre **PR** + entrega **Reporte de Etapa** (`03 §4bis`) → DETENTE.
   🔒 **NUNCA** `git commit`/`push` a **`main`**, **nunca** `merge` — **solo Alexander mergea**
   (último gate humano). **Nunca** toques `private/` ni imprimas secretos. Sin **CI verde**, el PR
   no es mergeable. No avances de milestone sin que el PR previo esté listo para revisión.
2. **No hay código sin spec.** Toda implementación referencia una spec en `/specs/NNN-*/`.
   Si no existe, primero se escribe la spec → **gate humano** → luego se construye.
3. **Respeta D1–D17.** Si crees que una decisión debe cambiar, PROPONLO; no la cambies solo.
4. **Honestidad científica.** Nada que contradiga `THEORETICAL-FOUNDATION.md`. Nunca etiquetes
   eventos individuales como "muón" en detectores de 1 SiPM (usa "tasa de partículas cargadas").
5. **Integridad de datos.** Promedios nunca sumas; sin filtrado de eventos; validar con `zod`.
6. **Capa de datos agnóstica.** Nunca llames al SDK de Firebase/Supabase directo desde la app;
   siempre vía `DataProvider`.
7. **Quédate en tu carril** (los paquetes de tu rol). Cambios cross-package → vía orquestador.
8. **Deja rastro:** actualiza el estado en tu spec y en el Issue de GitHub.
9. **TODO el código en inglés (D28).** Identificadores, variables, funciones, nombres de
   archivo, **comentarios**, mensajes de commit, claves de i18n, esquema de DB y nombres de
   API → **inglés**, desde el inicio. El inglés es el *source locale* de la UI; es/pt-BR son
   traducciones. Nada de espanglish ni traducción parchada en el código.
   **Documentos (D29):** specs nuevas, el reporte científico y la documentación de
   usuario/técnica → **inglés**; los docs internos de `planning/` pueden quedar en español
   hasta abrir el repo al público. (Pendiente: traducir `THEORETICAL-FOUNDATION.md` y `specs/0001`.)

---

## El primer corte vertical (MVP end-to-end) — meta de la Fase 1

Antes de construir features en ancho, lograr **una rebanada vertical funcionando de punta a
punta** con el stack nuevo, con el detector real de la USFQ:

```
Estación USFQ (1 Detector físico) → agente (lee serial + SQLite local)
   → DataProvider(Firebase munhub-1) → dashboard de estación muestra, EN VIVO:
     tasa de partículas cargadas + presión, con corrección de tiempo muerto y barométrica
     (β local), y el espectro de amplitud.
```

**Criterio de "MVP logrado":** un usuario autenticado crea su estación + detector, conecta el
detector por el agente, y ve su tasa corregida y su espectro actualizándose, con los datos
persistidos en munhub-1 y respaldados localmente. Valida toda la cadena (D1–D23) antes de escalar.

Specs que componen el MVP: **S01, S03, S04, S05, S06, S09, S11, S50, S12, S13, S14, S17, S18(parcial)**.

---

## Cómo elegir tu primera tarea

1. Abre `planning/04-BACKLOG.md` y mira la **ruta crítica** (EPIC-0 → 1 → 2 → 3 → …).
2. Toma la spec de mayor prioridad **sin dependencias abiertas**.
3. ¿No existe la spec en `/specs`? Escríbela con la plantilla de `03-AGENTS-AND-SDD.md` →
   pídela aprobar al humano → impleméntala. Ejemplo ya escrito: `specs/0001-monorepo-scaffold/`.
4. Verifica contra los criterios de aceptación + tests. Marca la spec. **Deja listo para que
   el humano commitee.**

---

## Mapa de carpetas (cuando exista el monorepo)

Ver `planning/01-ARCHITECTURE.md §2`. Resumen: `apps/web`, `apps/agent`, `services/api`,
`services/ai`, `packages/{shared,data-provider,ui,physics}`, `specs/`, `docs/`, `infra/`.

---

## Llaves y secretos
`private/` (service accounts de `munra-1` viejo y `munhub-1` nuevo) está en `.gitignore`.
**Nunca** las commitees ni las imprimas. En producción van por variables de entorno.
