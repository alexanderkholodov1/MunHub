# MunHub Lab v6.0 — Plan Maestro de Reconstrucción

> **Estado:** Capa 1 (decisiones fundacionales) CERRADA. Documento vivo.
> **Propósito:** Fuente de verdad de alto nivel para la reconstrucción completa de MunHub.
> Orientado a desarrollo agéntico (Spec-Driven Development). Los agentes leen este
> documento + `/specs` antes de actuar y NO se desvían de lo aquí acordado.
> **Regla de oro:** ningún agente hace `git commit` ni `git push`. El humano (Alexander)
> revisa y commitea. Los agentes proponen, escriben archivos y dejan todo listo.

---

## 0. Contexto y motivación

MunHub Lab es una plataforma web para adquisición, almacenamiento, visualización y
análisis en tiempo real de datos de detectores de rayos cósmicos (CosmicWatch / muones).
Nace como aporte de Alexander Kholodov a la investigación de Dennis Cazar en el laboratorio
LEOPARD (USFQ), dentro del proyecto EL-BONGO / Erasmus+ CBHE. Apunta a ser una **red
internacional multi-universidad en Latinoamérica**.

**Problemas de la v5.0 que motivan la reconstrucción:**
- Arquitectura no profesional: ~9.700 líneas de Vanilla JS en 12 IIFEs, sin build, sin
  tipos, sin tests, sin separación de capas. Lógica monolítica (serial 1641 líneas,
  auth 1563, charts 1098).
- Firebase Realtime DB **saturada y bloqueada** (límite 1 GB del plan gratuito).
- Sin landing pública, sin base científica explícita, visualización pobre, sin comparación
  con eventos externos, sin offline real, metadatos insuficientes para estadística valiosa.
- Lectura serial dependiente de scripts manuales de Python en Firefox/Safari.

**Visión v6.0:** plataforma profesional, modular, escalable a varios países, con fundamento
científico sólido, redundancia de datos como prioridad #1, desplegable tanto en nube
(Firebase puente) como en servidor propio (Red Clara, Supabase self-hosted), preparada para
una IA propia, y construida con flujo agéntico auditable.

---

## 1. Decisiones fundacionales (CERRADAS)

| # | Decisión | Elección | Fundamento |
|---|----------|----------|------------|
| D1 | **Frontend** | React + Next.js + TypeScript | SSR para landing/SEO + mapa, mayor ecosistema de charts/librerías científicas, mayor base de talento para colaboración multi-universidad. |
| D2 | **Backend/DB destino** | Supabase self-hosted + TimescaleDB | Postgres auto-hospedable en Red Clara, con auth/RLS, realtime y storage. Sin lock-in. TimescaleDB para series temporales científicas. |
| D3 | **Backend/DB puente** | Firebase `munhub-1` (proyecto fresco) | Red Clara aún no provisiona recursos. Se despliega YA en Firebase nuevo y se migra después. Service account en `private/` (NUNCA commitear). |
| D4 | **Capa de datos** | `DataProvider` agnóstico (FirebaseProvider \| SupabaseProvider) | Permite Fase A (Firebase) → Fase B (Supabase) sin reescribir la app. **Esta capa ES la herramienta de migración/importación de admin.** |
| D5 | **Lectura detector + offline** | Agente local instalable (Tauri) | Lee serial en cualquier SO sin Python manual + respaldo local SQLite + cola de sincronización offline. Resuelve serial + redundancia + offline. |
| D6 | **Estructura de código** | Monorepo (pnpm + Turborepo) | Tipos/esquema compartidos, una sola fuente de verdad, ideal para coordinación agéntica. |
| D7 | **Hardware objetivo** | Mayormente 1 SiPM (individual) | Restricción física: no se separa limpiamente muón vs electrón con un centellador delgado. La ciencia se basa en tasa, espectro de amplitud y coincidencia cuando exista. |
| D8 | **Multi-tenant** | Híbrido: Institución → Usuarios → Detectores, + usuarios independientes | Flexibilidad para universidades y para investigadores/estudiantes sueltos. |
| D9 | **Clasificación de partículas** | Por fases: honesta (física) → ML | Fase 1 rigurosa (amplitud + coincidencia + incertidumbre declarada). Fase 2 ML cuando haya datos. No sobreprometer. |
| D10 | **Redundancia de datos (prioridad #1)** | 3 capas: SQLite local + DB nube primaria + respaldos fríos automáticos | Local en cada PC del detector + nube primaria + dumps periódicos a almacenamiento frío barato. |
| D11 | **APIs externas** | NMDB + NOAA SWPC + NASA DONKI + Dst/Kp | Correlación científica con clima espacial. NMDB es lo más comparable (monitores de neutrones ↔ muones, decrecimientos Forbush). |
| D12 | **IA** | ML clásico primero, diseñado para escalar a DL | Anomalías, corrección barométrica, forecasting, Forbush, insights, "valores normales", self-heal/retraining. DL si luego hay GPU. Solo diseño ahora. |
| D13 | **Backlog/specs** | Specs en `/specs` (Markdown, SDD) + GitHub Issues/Projects | Specs versionadas junto al código (los agentes las leen); Issues para seguimiento/asignación. |
| D14 | **Licencia** | MIT | Permisiva y simple; máxima adopción por universidades/entusiastas; ciencia abierta. |
| D15 | **Toolkit frontend** | Tailwind + shadcn/ui + **Plotly** + **MapLibre** | Plotly para gráficos científicos (log, error bars, export); shadcn/ui accesible; MapLibre mapas vectoriales gratis (OSM). |
| D16 | **Almacenamiento frío (capa 3)** | Cloudflare R2 | S3-compatible, 10GB gratis, sin egreso; dumps automáticos; migrable a Red Clara. |
| D17 | **Idiomas (i18n)** | ES + EN + PT-BR | Cubre casi toda LatAm + ciencia internacional + Brasil. |
| D18 | **Hosting Fase A** | Firebase Hosting (Spark/gratis) + Next.js **static export** | Billing-proof (Spark bloquea, no cobra); moderno (React/Tailwind/shadcn); datos vía SDK cliente; dominio propio gratis cuando se decida. App Hosting/Blaze evitado por riesgo de cobro. Fase B: SSR completo en Red Clara. |
| D19 | **Licencia de datos** | CC-BY 4.0 (datos públicos) | Ciencia abierta con atribución obligatoria. Distinta de MIT (código). |
| D20 | **Mapa del landing** | Agregación por **ciudad** (burbujas escaladas/numeradas) | Propósito demostrativo (alcance/recepción), no localización precisa. Visualmente atractivo aun con pocos detectores. |
| D21 | **Modelo de entidades** | Dos niveles: **Estación** (perfil/sitio) → **Detector(es)** (dispositivo físico) | Resuelve la colisión de nombres; los datos van por detector; soporta device token y coincidencia futura. |
| D22 | **Visibilidad** | Elección **obligatoria** al crear estación, **sin default**; embargo opcional | El usuario decide explícitamente; se respeta cualquiera de las opciones. |
| D23 | **Configurabilidad** | Maximizar lo informativo / configurable / ajustable | Guardar todos los metadatos posibles; ajustes avanzados disponibles sin estorbar el flujo básico. Principio rector. |
| D24 | **Visibilidad y permisos** | 3 visibilidades (Pública/Institución/Privada) + permisos por estación (owner/editor/viewer) | `editor` puede escribir datos desde otra máquina; resuelve compartir edición. Ver `11`. |
| D25 | **Identidad y compartición** | Cuenta con email + username únicos + nombre; compartir por email/username mostrando nombre+institución | Selección fiable y con privacidad. Ver `11`. |
| D26 | **Monetización** | Núcleo gratis siempre; solo ganchos (entitlements+metering), **sin cobro en v6** | Misión de ciencia abierta; sostenibilidad por grants/donaciones. Ver `13`. |
| D27 | **Redes de estaciones** | Agrupar estaciones en redes/arrays para análisis conjunto | Eventos simultáneos = alta confianza; estudios geográficos. Ver `14`. |
| D28 | **Idioma del código** | **Inglés** en todo el código (identificadores, comentarios, commits, esquema, API, claves i18n) | Estándar internacional; el inglés es el *source locale* de la UI; es/pt-BR son traducciones. Evita traducción parchada. |
| D29 | **Idioma de documentos** | Híbrido: **specs nuevas, reporte científico y docs de usuario/técnicas en inglés**; `planning/` interno puede quedar en español hasta abrir el repo | Internacionalización donde importa (código-facing y público), sin retraducir todo ahora. Tareas pendientes: traducir `THEORETICAL-FOUNDATION.md` y `specs/0001` a inglés. |
| D30 | **Checkpoint por milestone** | Milestone = **entregable sustancial = 1 commit de Alexander** (no por archivo, no infinito sin guardar). Agente entrega + Reporte de Etapa y **se detiene**; Alexander revisa, commitea, autoriza seguir. Dimensionar a una sesión; working tree = red de seguridad | Control de tokens + poder volver a etapas exitosas. Issues ≠ checkpoints (eso son los commits). Ver `03 §4bis`. |
| D31 | **Ingesta de datos** | **Agente instalable (nuestro, hecho con Tauri) = camino ESTÁNDAR único**; Web Serial solo como **demo opcional con aviso** de "no se guarda offline". Visualización siempre web. Login = cuenta MunHub (sin segunda cuenta, sin servicio externo) | Cumple prioridad #1: no perder datos en detector 24/7 (offline/reinicio). |
| D32 | **Commits/push (revisada)** | **Feature-branch + PR + CI, `main` protegido.** Agentes commitean/pushean ramas y abren PR (Conventional Commits, inglés); **solo Alexander mergea**. Token de flota sin bypass. Sustituye la regla previa "los agentes nunca commitean" | El control se mueve de "teclear cada commit" (frágil) a "gates automáticos + `main` protegido + único merger humano": más eficiente y más seguro. Ver `18 §8`. |
| D33 | **Flota multi-proveedor** | Claude Opus orquesta e integra; ruteo por matriz (Sonnet/Haiku/Gemini/Cursor/Copilot); `AGENTS.md` = brief universal con shims; spec = unidad; worktree+paquete = carril; contratos-primero; olas de carriles disjuntos | Maximizar throughput y aprovechar suscripciones (Gemini/Cursor/Copilot) ahorrando quota Claude. Ver `18 §2–§3`. |
| D34 | **Calidad defense-in-depth** | Gates automáticos por PR (CI build/test/lint/typecheck + cobertura + gitleaks + Bugbot + Copilot review) + DoD por spec + gate de fase + auditor de completitud + E2E del MVP | Usar la flota para verificar calidad de cada paso/etapa y la completitud final. Ver `18 §6`. |
| D35 | **Revisión cruzada** | El autor nunca es el único revisor; revisa un **proveedor distinto**; personas Claude (Físico/Seguridad/Arquitecto) en PRs relevantes | Cada modelo tiene puntos ciegos distintos; el *ensemble* atrapa más que el auto-review. Ver `18 §6 Capa B/C`. |

---

## 2. Arquitectura objetivo (alto nivel)

```
                         ┌─────────────────────────────────────────┐
   [Detector USB] ──────▶│  AGENTE LOCAL (Tauri, multiplataforma)   │
                         │  • Lee serial (todos los SO)             │
                         │  • Respaldo local SQLite (capa 1)        │
                         │  • Cola de sync offline → reintenta      │
                         └───────────────────┬─────────────────────┘
                                             │ (HTTPS/WSS, autenticado)
                                             ▼
                         ┌─────────────────────────────────────────┐
                         │     CAPA DE DATOS AGNÓSTICA (D4)         │
                         │  DataProvider ──┬── FirebaseProvider     │  Fase A
                         │                 └── SupabaseProvider     │  Fase B
                         └───────────────────┬─────────────────────┘
                                             ▼
              ┌──────────────────────────────────────────────────────┐
              │  DB primaria (capa 2)    +   Respaldos fríos (capa 3) │
              │  Firebase munhub-1  →  Supabase/Postgres+TimescaleDB  │
              └───────────────────┬──────────────────────────────────┘
                                  ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                    WEB (Next.js, React, TS)                       │
   │  • Landing pública (mapa de detectores, demo en vivo, educación)  │
   │  • Dashboard de detector (charts, stats, espectros, clasificación)│
   │  • Dashboard de cuenta / institución                             │
   │  • Dashboard de administrador del sistema (DB, migración, usuarios)│
   │  • Páginas de correlación con APIs externas (clima espacial)      │
   └──────────────────────────────────────────────────────────────────┘
                                  ▲
   ┌──────────────────────────────┴───────────────────────────────────┐
   │   SERVICIOS (Fase B, servidor Red Clara)                          │
   │  • api/  servicios backend / edge functions                       │
   │  • ai/   pipeline ML (Python): anomalías, forecasting, insights   │
   │  • ingest de APIs externas (NMDB, NOAA SWPC, DONKI, Dst/Kp)        │
   └──────────────────────────────────────────────────────────────────┘
```

### Layout del monorepo (propuesto)

```
munhub/
├─ apps/
│  ├─ web/              # Next.js: landing + dashboards + admin
│  └─ agent/            # Tauri: serial + SQLite local + sync offline
├─ services/
│  ├─ api/              # (Fase B) backend / edge functions
│  └─ ai/              # (diseño ahora) pipeline ML en Python
├─ packages/
│  ├─ shared/           # tipos, esquema, constantes, validación (zod)
│  ├─ data-provider/    # capa agnóstica D4 (Firebase | Supabase)
│  ├─ ui/               # design system / componentes reutilizables
│  └─ physics/          # cálculos científicos (corrección barométrica, flujo, espectros)
├─ specs/               # Spec-Driven Development: una carpeta por feature
├─ docs/
│  ├─ user/             # manual de usuario + FAQ
│  ├─ technical/        # arquitectura, despliegue, ADRs
│  ├─ research/         # fundamento científico (reporte teórico base)
│  └─ paper/            # borrador del artículo (baja prioridad)
├─ infra/               # docker, IaC, configs de despliegue (Red Clara)
└─ .github/             # CI/CD, plantillas de issues/PR
```

---

## 3. Modelo de datos (lineamientos; detalle en spec dedicada)

**Entidades (modelo de dos niveles, D21):** `institutions`, `users`, `stations` (perfil/sitio),
`detectors` (dispositivo físico, bajo una estación), `sessions`, `minute_records` (serie
temporal, **por detector**), `realtime_records`, `external_events` (APIs), `ai_insights`.
Detalle en `02-DATA-MODEL.md`.

**Metadatos OBLIGATORIOS:**
- **Estación (sitio):** nombre, **lat/lon/altitud (manual)**, ciudad, país, emplazamiento,
  `type` (single/coincidence), timezone, **visibilidad (sin default, D22)**, institución (si aplica).
- **Detector (aparato):** modelo, firmware, `hw_version` (define τ_DT), # SiPM, `device_token`
  (autogenerado), `calibration` (defaults por hw + edición avanzada opcional).

**Compatibilidad hacia atrás (máxima):** estaciones/usuarios v5 sin metadatos se importan igual
(+ se crea 1 detector con defaults); **notificación no intrusiva** para completarlos. Obligatorio
solo en altas nuevas.

**Invariante científico (heredado, NO negociable):** todos los valores por minuto son
**promedios, nunca sumas** (`ec`, `cc`, `sm/sx/sn`, `tp`, `pr`, `dt`). Sin filtrado de eventos.

---

## 4. Hoja de ruta por fases

| Fase | Nombre | Resultado | Backend |
|------|--------|-----------|---------|
| **F0** | Planificación (ACTUAL) | Specs, research físico, arquitectura, ADRs, backlog | — |
| **F1** | Cimientos | Monorepo + `data-provider` + `shared` schema + auth/multi-tenant + migración de datos v5→v6 | Firebase munhub-1 |
| **F2** | Núcleo de adquisición y visualización | Agente Tauri (serial+SQLite+sync) + dashboards reconstruidos (muchos más charts, espectros, stats, comparación) | Firebase |
| **F3** | Landing pública | Mapa de detectores activos, demo en vivo de detector público, secciones educativas/info | Firebase |
| **F4** | Correlación externa | Ingesta NMDB/NOAA/DONKI/Dst-Kp + vistas de correlación con eventos terrestres/solares | Firebase |
| **F5** | Admin avanzado | Página dedicada: gestión de DB, **migración entre proveedores**, importación/conversión de DB externa, gestión de usuarios/roles, respaldos fríos | Firebase |
| **F6** | Migración a servidor propio | Despliegue Supabase self-hosted + TimescaleDB en Red Clara; switch del DataProvider | → Supabase |
| **F7** | IA | Despliegue del pipeline ML (anomalías, forecasting, insights, self-heal) | Supabase + ai/ |
| **F8** | Documentación + paper | Manual usuario/FAQ, doc técnica completa, base del artículo científico | — |

> La compatibilidad hacia atrás y la **seguridad/redundancia de datos** son transversales a
> todas las fases, no una fase aparte.

---

## 5. Roster de agentes y flujo Spec-Driven (resumen; detalle en Capa 4)

- 🔬 **Físico investigador** — fundamento teórico, qué es medible con 1 SiPM, validez de stats.
- 🏗️ **Arquitecto** — diseño de sistema, esquema, ADRs, revisión de coherencia.
- 💻 **Dev Frontend / Backend / Agente-local** — implementación por specs.
- 🗄️ **Ingeniero de datos/DB** — migración, redundancia, time-series.
- 🤖 **Ingeniero ML** — diseño del modelo propio + plan de recursos.
- 🔐 **Seguridad** — auth, RLS, integridad y redundancia de datos.
- 📖 **Documentación** — manuales + paper.
- 🧭 **Orquestador** — mantiene a los agentes en su carril (specs como contrato).

**Flujo SDD:** Idea → Spec (`/specs/NNN-feature/`) con requisitos + criterios de aceptación
→ revisión humana → tareas atómicas → implementación → verificación contra criterios.

---

## 6. Entregables de planificación (estado)

- [x] `00-MASTER-PLAN.md` (este documento)
- [x] `research/PHYSICS-DEEP-RESEARCH-PROMPT.md` → ejecutado; resultados en
  `research/DEEP-RESEARCH-RESULTS.md` (temporal, descartable tras destilar)
- [x] `01-ARCHITECTURE.md` — arquitectura detallada + ADRs clave
- [x] `02-DATA-MODEL.md` — esquema completo + metadatos + migración v5→v6
- [x] `03-AGENTS-AND-SDD.md` — roster, prompts base de agentes, plantillas de spec
- [x] `04-BACKLOG.md` — épicas → specs → tareas con criterios de aceptación
- [x] `05-REDUNDANCY-AND-SECURITY.md` — diseño de 3 capas + auth/RLS
- [x] `06-AI-DESIGN.md` — diseño del modelo propio (solo planificación)
- [x] `07-EXTERNAL-APIS.md` — contratos de NMDB/NOAA/DONKI/Dst-Kp
- [x] `RED-CLARA-RESOURCE-TIERS.md` — 3 tiers de recursos a solicitar (tras fijar arquitectura+IA)
- [x] `docs/research/THEORETICAL-FOUNDATION.md` — reporte teórico final (base científica oficial)
- [x] `08-RISKS-AND-ASSUMPTIONS.md` — riesgos, supuestos, mitigaciones
- [x] `09-DETECTOR-LIFECYCLE.md` — registro, auth, calibración por equipo, mantenimiento
- [x] `10-OPERATIONS-AND-GOVERNANCE.md` — observabilidad/ops + gobernanza de datos
- [x] `/AGENTS.md` (raíz) — **punto de entrada para agentes** + definición del corte vertical MVP
- [x] `specs/0001-monorepo-scaffold/spec.md` — spec de ejemplo (patrón SDD)
- [x] `11-PERMISSIONS-SHARING-ROLES.md` — visibilidad, roles, compartición
- [x] `12-SUPPORT-NOTIFICATIONS-EMAIL.md` — tickets, centro de notificaciones, email
- [x] `13-MONETIZATION-AND-ENTITLEMENTS.md` — postura + ganchos (sin cobro en v6)
- [x] `14-STATION-NETWORKS.md` — redes de estaciones para análisis conjunto
- [x] `15-ADMIN-CONSOLE.md` — consola admin completa (audit log, anuncios, onboarding…)
- [x] `16-DEPLOYMENT-AND-CUTOVER.md` — estado real de despliegue + cutover seguro (GATED)
- [x] `17-ACADEMIC-POSITIONING-AND-GOVERNANCE.md` — ORCID, atribución, DOI, ciencia abierta, legal
- [x] `docs/technical/SERIAL-FORMATS.md` · `docs/technical/adr/002-local-agent-framework.md`

---

## 7. Decisiones aún PENDIENTES (próximas rondas con el humano)

**Resueltas:** landing esencial pulido (F3); hosting Fase A (D18); licencia de datos (D19);
mapa por ciudad (D20); modelo Estación+Detector (D21); visibilidad obligatoria (D22);
configurabilidad (D23); auth (usuario+token, refuerzo en Fase B); calibración (defaults +
avanzada opcional); auto-update (automático en background); embargo (opcional).

**Pendiente (no bloquea):**
1. **Dominio definitivo** (decidir con el tutor; prototipo en `munhub-lab.web.app`, dominio
   propio conectable gratis cuando se decida).
2. **Branding fino** (logo, paleta) — se ajusta al construir el landing (F3).

---

## 8. Notas de seguridad operativa

- **Llaves en `private/` (ambas en `.gitignore`, NUNCA commitear; en prod por entorno/secreto):**
  - `munra-1-firebase-adminsdk-*.json` → proyecto **viejo v5** (DB 1GB saturada/bloqueada) =
    **fuente** de la migración v5→v6.
  - `munhub-1-firebase-adminsdk-*.json` → proyecto **nuevo v6** = **destino** (Fase A).
- Toda config sensible (claves Firebase, futuras de Supabase) vive en `.env` (no versionado)
  y se documenta en `.env.example` (sin valores reales).
