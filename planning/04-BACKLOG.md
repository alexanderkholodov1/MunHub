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
- **S07 — Migración v5→v6** (dump → transform → `importAll`).
  - Fuente: **dump frío de ~1GB** `private/munra-1_realtime_database_backup/*_data.json.gz`
    (munra-1 deshabilitada). **Parsear en streaming** (no cargar 1GB en memoria).
  - CA: idempotente, reanudable; reporte de migrados/cuarentena/sin-metadatos.
  - CA: `profiles→Estación` **+ crear un Detector** (con device_token y calibración por defecto);
    `organizations→Institución`; `sharedWith→station_shares`; `d→dt`, presión a hPa.
- **S08 — Config munhub-1**: reemplazar claves Firebase, reglas v6, índices.
  - CA: reglas deny-by-default; detectores public/unlisted legibles; tests de reglas.

## EPIC-3 — Auth y multi-tenant  (F1)  [dev backend + seguridad]
- **S09 — Auth** (Firebase Auth tras `DataProvider`): registro/login, idioma preferido.
- **S10 — Roles, tenancy y permisos** (ver `11`): roles `admin|institution_admin|user|guest`;
  **3 visibilidades** (pública/institución/privada); **permisos por estación** owner/editor/viewer
  (`editor` puede escribir datos); `username` único + compartición por email/username.
  - CA: un usuario solo ve/edita lo permitido; institution_admin gestiona su institución; tests
    negativos por combinación rol×permiso×visibilidad.
- **S11 — Crear Estación + onboarding de metadatos + notificación no intrusiva** (compat).
  - CA: alta nueva exige metadatos de **estación** (§3) con **visibilidad obligatoria sin
    default** (D22); estaciones v5 sin metadatos muestran aviso no bloqueante.
- **S50 — Gestión de Detectores (dispositivo) bajo una Estación** [dev backend + frontend]
  - T: registrar Detector(es) con hardware/firmware/hw_version/sipm_count; **device_token**
    autogenerado (no bloquea registro); ajustes avanzados (calibración + reset a defaults).
  - CA: una estación puede tener ≥1 detector; **aviso de consistencia** si llega un
    `device_token` distinto al registrado (recomendar nueva estación/detector).
  - CA: defaults de calibración por `hw_version`; edición avanzada opcional visible en ajustes.

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
- **S16 — Web Serial (modo DEMO opcional, secundario al Agente)**: atajo sin instalar
  (Chromium) para pruebas rápidas, con **aviso claro** de que no guarda datos sin conexión / con
  la pestaña cerrada; para monitoreo continuo se usa el Agente (camino estándar, EPIC-4).
  - CA: conectar/leer en Chromium y persistir vía `DataProvider`; mostrar el aviso de limitación.

## EPIC-5 — Dashboards y visualización  (F2)  [dev frontend + físico]
- **S17 — Dashboard de estación** (rediseño): grilla de charts configurable; agrega los
  detectores de la estación (en `single` = su único detector, transparente).
- **S18 — Muchos más gráficos/estadísticas**: serie temporal multi-variable, **espectro de
  amplitud (energía depositada)**, histograma de tasa, tasa corregida por presión,
  variación diurna, box/stat summary, rolling stats.
  - CA: escala log y barras de error donde aplique (Plotly).
  - **Charts primarios = relevantes para las partículas** (tasa corregida, espectro, presión).
    El **dead time NO es chart principal** (es salud/fiabilidad del detector, no informa sobre
    las partículas): va como métrica **secundaria/seleccionable**, no ocupando 1/4 de pantalla
    como en v5. Mostrar salud del detector en un panel aparte/compacto.
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
- **S23 — Mapa de detectores** (MapLibre): **agregación por ciudad** (D20) con burbujas
  escaladas/numeradas según cuántos detectores hay; muestra **cuántos activos ahora**.
  Propósito demostrativo (alcance/recepción), visualmente atractivo aun con 1 detector.
  - CA: burbuja por ciudad cuyo tamaño/número refleja el conteo; estado activo/inactivo; NO
    expone ubicación exacta (solo ciudad).
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

## EPIC-12 — Documentación y paper  (al FINAL, tras construir v6; foco F8)  [documentación + físico]
> **Idioma (D29):** la documentación técnica y el manual de usuario se escriben **primero en
> inglés** y luego se **traducen** a los idiomas de la plataforma (es, pt-BR).
> **Flujo de entrega:** se produce en **.md** → **Alexander lee y edita** → solo con su
> **aprobación final** se exporta a **PDF** (u otro formato) para el usuario. No generar PDF antes.
- **S46 — Manual de usuario + FAQ** (universidades y público; cómo unir un detector). EN→es/pt.
- **S47 — Documentación técnica**: arquitectura, esquema, despliegue (Firebase y Red Clara). EN→es/pt.
- **S48 — Base del artículo científico** (estructura + fundamento teórico; baja prioridad).
- **S73 — Artefactos académicos/comunidad** (ver `17`): `CITATION.cff`, `AUTHORS.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, versionado semántico + `CHANGELOG.md`, y preparar
  **Zenodo↔GitHub** para DOI de releases. (ORCID/IP = acciones humanas de Alexander.)
- **S49 — `RED-CLARA-RESOURCE-TIERS.md`** (3 tiers; tras cerrar IA/arquitectura).

---

## EPIC-13 — Soporte, notificaciones y email  (F5; notif. in-app desde F2)  [frontend + backend]
- **S51 — Centro de notificaciones** (in-app): detector caído, gaps, anomalías, invitaciones,
  recordatorio de metadatos, cambios de permiso; preferencias por tipo/canal.
- **S52 — Email transaccional** (proveedor free billing-proof; plantillas i18n; SPF/DKIM).
- **S53 — Sistema de tickets** (categorías, metadatos automáticos, hilo, estados) + bandeja admin.
- **S54 — FAQ pública** + (opcional) votación de sugerencias.

## EPIC-14 — Redes de estaciones  (F4/F5)  [frontend + backend + físico]
- **S55 — CRUD de redes + vincular estaciones** (al crear/editar estación o desde panel).
- **S56 — Vista comparativa multi-estación** (overlay, agregados, mapa de red).
- **S57 — Detección de eventos simultáneos en la red** (Forbush en N estaciones = alta confianza;
  criterio validado por el agente físico).

## EPIC-15 — Consola de administración ampliada  (F5)  [backend + frontend + seguridad]
- **S58 — Página admin dedicada** + gestión usuarios/roles/instituciones (crear en nombre de terceros).
- **S59 — Gestión de estaciones/detectores + ciclo de vida de institución** (reasignar dueño,
  permisos, mover de institución; **eliminar/transferir una institución** y reubicar sus
  estaciones y usuarios de forma segura, con respaldo y confirmación destructiva).
- **S60 — Confirmaciones destructivas estilo GitHub** + soft-delete + respaldo previo.
- **S61 — Audit log** (append-only, consultable/exportable).
- **S62 — Anuncios/broadcast + feature flags + ver-como-usuario** (registrado en audit).
- **S63 — Onboarding wizard** (institución→estación→detector→agente; ejecutable en nombre de otro).

## EPIC-16 — Cuenta y plataforma  (F1 base; resto F5+)  [backend + frontend]
- **S64 — Ciclo de vida de cuenta**: verificación de email, reset de contraseña, **borrado de
  cuenta/datos** (GDPR-like), inactividad. `username` único + `directory_opt_in`.
- **S65 — Consentimiento ML** (opt-out por estación + default de usuario; mensaje honesto). Lo
  respeta el pipeline de IA (S40).
- **S66 — Entitlements + metering** (esquema `plans/entitlements/usage_events`; todos en "Open";
  **sin pasarela de pago** — D26). Ver `13`.
- **S67 — API pública de solo-lectura** (datos públicos, con cuota; base para extras futuros).
- **S68 — Citación de datasets** (identificador estable estilo DOI) + Status page.
- **S69 — Importar datos históricos + respaldo ZIP** (preservar de v5): subir CSV/archivo de
  datos pasados a una estación con **deduplicación** (clave `(detector,ts)`); backup/restore ZIP
  (portar `upload-manager.js`/`session-manager.js` de v5). Evita regresión de funcionalidad.
- **S70 — Modo totalmente local del agente** (offline-first): ver/grabar datos localmente sin
  nube (internet caído o sin cuenta aún); sincroniza al reconectar. Refuerza la promesa offline.
- **S71 — Calidad de datos, robustez y concurrencia**: distinguir **gap por detector apagado**
  vs **reporte de cero**; cotas de cordura para timestamps (marcar/rechazar duplicados o
  futuros); **reconciliación de escritores concurrentes** (varios agentes/editores en la misma
  estación → orden por ts, resolución de conflictos); **health score** del detector (fiabilidad).
- **S72 — Localización y difusión**: unidades/locale por idioma (hPa/°C, separador decimal);
  **consentimiento de Términos versionado**; **enlace/embed público** de un chart para difusión
  (outreach). Todo i18n (es/en/pt-BR), con inglés como *source locale* (D28).

## Dependencias clave
- EPIC-1/2/3 son prerrequisito de casi todo.
- EPIC-5 depende de S03/S04/S06; EPIC-6 depende de EPIC-5; EPIC-7 de EPIC-2.
- EPIC-11 puede hacerse cuando llegue Red Clara, sin reescribir la app (gracias a S05).
- EPIC-10 build solo tras EPIC-11 (servidor) + datos suficientes.
