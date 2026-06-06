# MunHub Lab v6.0 — Backlog (Épicas → Specs → Tareas)

> Depende de: `00`–`03`. Backlog priorizado para la "manada" de agentes.
> Cada Spec se materializa en `/specs/NNN-slug/spec.md` (plantilla en `03-AGENTS-AND-SDD.md`).
> `[agente]` = rol responsable (ver roster). `Fase` = F1–F8 del plan maestro.
> Marcado: ☐ pendiente · ◐ en curso · ☑ hecho. Todo arranca en ☐.

---

## Orden recomendado (ruta crítica)
`EPIC-0 → EPIC-1 → EPIC-2 → EPIC-3 → EPIC-4/5 (paralelo) → EPIC-6 → EPIC-7 → EPIC-8 → EPIC-9 (transversal) → EPIC-11 → EPIC-10 → EPIC-12 (continuo)`

---

## EPIC-0 — Cimientos de repo y tooling  (Fase F1)  [arquitecto]
**Objetivo:** monorepo operativo y CI base.

- **S01 — Scaffold monorepo** (pnpm + Turborepo)
  - T: estructura `apps/`, `services/`, `packages/`, `specs/`, `docs/`, `infra/`, `.github/`.
  - T: TS estricto, ESLint, Prettier, Vitest base; LICENSE (MIT); `.gitignore` (incluye `private/`, `.env`).
  - CA: `pnpm install && pnpm build && pnpm test` corre verde en todos los paquetes.
  - CA: `private/` y `.env` ignorados; existe `.env.example`.
- **S02 — CI/CD GitHub Actions**
  - T: workflow lint+typecheck+test en PR; deploy a Firebase Hosting/Vercel en merge.
  - CA: PR de prueba ejecuta los 3 checks; merge despliega.

## EPIC-1 — Shared schema + física  (F1)  [arquitecto + físico]
- **S03 — `packages/shared`**: tipos (User, Institution, Detector, MinuteRecord…), esquemas
  `zod`, constantes (campos canónicos, unidades), claves i18n.
  - CA: validación rechaza registros que violen invariantes (sumas, campos faltantes).
  - CA: reconciliación de campos v5 (`d`→`dt`, presión hPa) centralizada aquí.
- **S04 — `packages/physics`**: **corrección de tiempo muerto** (`R/(1−R·τ_DT)`),
  **corrección barométrica con β LOCAL por regresión**, espectro de amplitud (Landau/MPV),
  flujo, rangos "normales" y estadística de Poisson (√N, ventanas de horas, 3σ).
  - CA: tests contra valores de referencia de `docs/research/THEORETICAL-FOUNDATION.md`
    (MIP ~2 MeV, β en rango documentado, corrección de dead-time).
  - Reporte teórico ✅ disponible (`docs/research/THEORETICAL-FOUNDATION.md`).

## EPIC-2 — Capa de datos + migración  (F1)  [dev backend/datos]
- **S05 — Interfaz `DataProvider`** (`packages/data-provider/types.ts`).
  - CA: interfaz cubre lectura/escritura/realtime/CRUD/export/import (ver `01-ARCH §3`).
- **S06 — `FirebaseProvider`** sobre munhub-1; listeners incrementales (no `once('value')`).
  - CA: lee/escribe detectores, minutes, realtime; respeta reglas; sin re-descarga masiva.
- **S07 — Migración v5→v6** (export → transform → `importAll`).
  - CA: idempotente, reanudable; reporte de migrados/cuarentena/sin-metadatos.
  - CA: `profiles→detectors`, `organizations→institutions`, `sharedWith→detector_shares`.
- **S08 — Config munhub-1**: reemplazar claves Firebase, reglas v6, índices.
  - CA: reglas deny-by-default; detectores public/unlisted legibles; tests de reglas.

## EPIC-3 — Auth y multi-tenant  (F1)  [dev backend + seguridad]
- **S09 — Auth** (Firebase Auth tras `DataProvider`): registro/login, idioma preferido.
- **S10 — Roles y tenancy híbrida**: `admin|institution_admin|user|guest`; Institución→
  Usuarios→Detectores + independientes.
  - CA: un usuario solo ve/edita lo permitido; institution_admin gestiona su institución.
- **S11 — Onboarding de metadatos + notificación no intrusiva** (compat. hacia atrás).
  - CA: alta nueva exige metadatos obligatorios (§3 data-model); detectores viejos sin
    metadatos muestran aviso que no bloquea el flujo.

## EPIC-4 — Agente local Tauri  (F2)  [dev agente-local]
- **S12 — Lectura serial multiplataforma**: portar 4 formatos (CosmicWatch/JSON/KV/CSV).
  - CA: detecta los 4 formatos igual que v5 (tests con muestras reales).
- **S13 — Respaldo local SQLite** (capa 1 de redundancia).
  - CA: cada registro se persiste local ANTES de intentar subir.
- **S14 — Cola de sync offline + idempotencia**.
  - CA: sin red, sigue grabando; al reconectar sube lo adelantado sin duplicar (clave
    `(detector, ts)`); reconciliación local↔nube.
- **S15 — Empaquetado/instaladores** (Windows/macOS/Linux), sin scripts manuales de Python.
  - CA: instalador de 1 clic por SO; detecta puerto serial y conecta.
- **S16 — (opcional) Web Serial en navegador** como camino rápido Chromium.

## EPIC-5 — Dashboards y visualización  (F2)  [dev frontend + físico]
- **S17 — Dashboard de detector** (rediseño): grilla de charts configurable.
- **S18 — Muchos más gráficos/estadísticas**: serie temporal multi-variable, **espectro de
  amplitud (energía depositada)**, histograma de tasa, tasa corregida por presión,
  variación diurna, box/stat summary, rolling stats.
  - CA: escala log y barras de error donde aplique (Plotly).
- **S19 — Comparación y contraste**: comparar varios detectores/sesiones/rangos; overlay y
  diferencia; correlación tasa↔presión.
  - CA: seleccionar ≥2 series y compararlas en un mismo eje temporal.
- **S20 — Etiquetado honesto de partículas** (D9 fase 1): métrica principal = **"Tasa
  integral de partículas cargadas / tipo-MIP"** (NO "muones") en `single`; dominancia muónica
  solo agregada y dependiente de altitud; "muones" con rigor solo en `coincidence`. Tooltips
  con textos de `THEORETICAL-FOUNDATION.md`.
  - CA: ningún evento individual se etiqueta "muón" en detectores `single`; lenguaje aprobado
    por el agente físico.
- **S21 — Export multi-formato** (CSV/JSON/imagen) — portar/expandir de v5.
- **S22 — i18n (es/en/pt-BR)**, tema claro/oscuro, accesibilidad.

## EPIC-6 — Landing pública  (F3)  [dev frontend + documentación]
- **S23 — Mapa de detectores** (MapLibre): muestra ubicaciones y **cuántos activos ahora**.
  - CA: marcador por detector público con estado activo/inactivo; popup con metadatos.
- **S24 — Demo en vivo** de un detector público (chart en tiempo real).
- **S25 — Secciones educativas**: qué son rayos cósmicos/muones, cómo funciona, por qué
  Ecuador, cómo unirse; botones de info; acceso a documentación; CTA registro.
  - CA: contenido revisado por físico + documentación; comprensible para no expertos.

## EPIC-7 — APIs externas y correlación  (F4)  [dev backend + físico]
- **S26 — Ingesta NMDB** (monitores de neutrones; Forbush) → `external_events` (ver `07`).
- **S27 — Ingesta NOAA SWPC** (viento solar, Kp, fulguraciones).
- **S28 — Ingesta NASA DONKI** (CME/flares) + **Dst/Kp** (Kyoto/GOES).
- **S29 — Vistas de correlación**: overlay de eventos externos sobre nuestras series;
  detección visual de Forbush; comparación muones↔neutrones.
  - CA: marcar un evento externo y verlo alineado temporalmente sobre el chart del detector.

## EPIC-8 — Consola de administrador  (F5)  [dev backend + dev frontend + seguridad]
- **S30 — Página de admin dedicada** (separada del dashboard normal).
- **S31 — Gestión de bases de datos**: ver stats, cambiar URL/proveedor en runtime.
- **S32 — Herramienta de migración** entre proveedores (usa `exportAll`/`importAll`).
  - CA: migrar de un provider a otro con reporte y validación; reanudable.
- **S33 — Importar DB externa desde archivo** (adaptador → esquema v6).
  - CA: subir archivo, mapear, validar `zod`, cargar; filas inválidas en cuarentena.
- **S34 — Gestión de usuarios/roles/instituciones** (asignar roles, mover detectores).

## EPIC-9 — Redundancia y seguridad  (transversal, foco F5)  [ing. DB + seguridad]
- **S35 — Respaldos fríos a Cloudflare R2** (dumps comprimidos + checksum + rotación).
  - CA: job programado genera dump restaurable; verificación de checksum.
- **S36 — Restauración** desde respaldo frío (`importAll`).
- **S37 — Auditoría de seguridad**: reglas/RLS deny-by-default, secretos fuera del repo,
  revisión de permisos.
- **S38 — Verificación de integridad** periódica (detectar gaps/corrupción).

## EPIC-10 — IA propia  (diseño F0, build F7)  [ing. ML + físico]
- **S39 — `06-AI-DESIGN.md`** (diseño completo; solo planificación ahora).
- **S40 — Pipeline ML** (F7): anomalías, forecasting, detección de Forbush, modelado
  barométrico, insights/"valores normales", self-heal/retraining.
- **S41 — Contrato `ai_insights`** + UI para mostrar insights/explicaciones/predicciones.

## EPIC-11 — Migración a servidor propio  (F6)  [ing. DB + arquitecto]
- **S42 — `SupabaseProvider`** (misma interfaz `DataProvider`).
- **S43 — Esquema Postgres + TimescaleDB** (hypertables, continuous aggregates, retención).
- **S44 — RLS** equivalente a reglas Fase A.
- **S45 — Despliegue Docker en Red Clara** (`infra/`); switch del provider; migración de datos.
  - CA: la app funciona idéntica sobre Supabase; datos migrados verificados.

## EPIC-12 — Documentación y paper  (continuo, foco F8)  [documentación + físico]
- **S46 — Manual de usuario + FAQ** (universidades y público; cómo unir un detector).
- **S47 — Documentación técnica**: arquitectura, esquema, despliegue (Firebase y Red Clara).
- **S48 — Base del artículo científico** (estructura + fundamento teórico; baja prioridad).
- **S49 — `RED-CLARA-RESOURCE-TIERS.md`** (3 tiers; tras cerrar IA/arquitectura).

---

## Dependencias clave
- EPIC-1/2/3 son prerrequisito de casi todo.
- EPIC-5 depende de S03/S04/S06; EPIC-6 depende de EPIC-5; EPIC-7 de EPIC-2.
- EPIC-11 puede hacerse cuando llegue Red Clara, sin reescribir la app (gracias a S05).
- EPIC-10 build solo tras EPIC-11 (servidor) + datos suficientes.
