# MunHub Lab v6.0 — Arquitectura detallada

> Depende de: [`00-MASTER-PLAN.md`](00-MASTER-PLAN.md) (decisiones D1–D17).
> Lectura obligatoria para todo agente de implementación.

---

## 1. Principios de arquitectura

1. **Provider-agnostic data:** la app nunca habla directo con Firebase/Supabase. Todo pasa
   por `packages/data-provider`. Cambiar de backend = cambiar una implementación, no la app.
2. **Offline-first en el borde:** el detector nunca pierde datos. El agente local persiste
   antes de sincronizar.
3. **Integridad científica por contrato:** los invariantes (promedios nunca sumas, sin
   filtrado de eventos) se validan con esquemas (`zod`) en `packages/shared`, no por
   convención.
4. **Tipos compartidos, una fuente de verdad:** modelos, esquema y constantes viven en
   `packages/shared` y los consumen web, agente, api y ai.
5. **Seguridad por defecto:** RLS/rules denegar-por-defecto; secretos fuera del repo;
   redundancia de datos como requisito, no opción.
6. **Spec-Driven:** ningún código sin una spec en `/specs` con criterios de aceptación.
7. **Procesamiento en el borde:** maximizar transformación/agregación/pre-cálculo en el PC
   del detector (agente Tauri) — promedios por minuto, features, validación — para **aliviar
   al servidor**. La nube/servidor se reserva para ML y procesos globales (correlación
   multi-detector, agregados de red). Esto reduce la carga de servidor y el ancho de banda.
8. **Máxima configurabilidad (D23):** preferir lo informativo, configurable y ajustable.
   Guardar **todos los metadatos posibles**; exponer ajustes avanzados (calibración, umbrales,
   device token, etc.) **sin estorbar el flujo básico** — patrón: defaults sensatos + override
   opcional + botón "volver a defaults".

---

## 2. Vista de componentes

```
packages/shared          → tipos TS, esquemas zod, constantes, i18n keys, utilidades puras
packages/physics         → cálculos científicos puros (corrección barométrica, flujo,
                           espectros, rangos normales). Sin dependencias de IO. Testeable.
packages/data-provider   → interfaz DataProvider + FirebaseProvider + SupabaseProvider
packages/ui              → design system (Tailwind + shadcn/ui) + componentes de charts (Plotly)

apps/web (Next.js)       → landing pública, dashboards (detector/cuenta/institución/admin),
                           páginas de correlación externa. SSR para landing/SEO.
apps/agent (Tauri)       → lectura serial multiplataforma + SQLite local + cola de sync

services/api             → (Fase B) backend/edge functions: ingest, agregaciones, jobs
services/ai              → (diseño ahora) pipeline ML en Python (anomalías, forecasting…)

infra/                   → docker-compose (Supabase+TimescaleDB), IaC, scripts de despliegue
```

### Dependencias permitidas
- `web`, `agent`, `api`, `ai` → pueden depender de `shared`, `data-provider`, `physics`.
- `web` → además `ui`.
- `physics` y `shared` → **no** dependen de nada con IO (puros, testeables aislados).
- `data-provider` → depende solo de `shared`.

---

## 3. La capa de datos agnóstica (keystone)

`packages/data-provider` expone una interfaz única. La app la consume sin saber el backend.
**Esta interfaz es también la base de la herramienta de migración de admin** (export desde un
provider → import a otro).

```ts
// packages/data-provider/src/types.ts  (boceto, no final)
export interface DataProvider {
  // --- Auth & tenancy ---
  getCurrentUser(): Promise<User | null>;
  // --- Estaciones (perfil/sitio) ---
  listStations(filter?: StationFilter): Promise<Station[]>;
  getStation(id: string): Promise<Station>;
  upsertStation(s: Station): Promise<void>;
  // --- Detectores (dispositivo físico, bajo una estación) ---
  listDetectors(stationId: string): Promise<Detector[]>;
  upsertDetector(d: Detector): Promise<void>;
  // --- Datos (por detector) ---
  getMinuteRecords(detectorId: string, range: TimeRange): Promise<MinuteRecord[]>;
  subscribeRealtime(detectorId: string, cb: (r: RealtimeRecord) => void): Unsubscribe;
  getLatest(detectorId: string): Promise<MinuteRecord | null>;
  pushMinuteRecord(detectorId: string, rec: MinuteRecord): Promise<void>;   // agente/ingest
  pushRealtimeRecord(detectorId: string, rec: RealtimeRecord): Promise<void>;
  // --- Instituciones / admin ---
  upsertInstitution(i: Institution): Promise<void>;
  exportAll(opts: ExportOptions): AsyncIterable<DataChunk>;   // migración (streaming)
  importAll(chunks: AsyncIterable<DataChunk>): Promise<ImportReport>;
}

export class FirebaseProvider implements DataProvider { /* Fase A */ }
export class SupabaseProvider implements DataProvider { /* Fase B */ }
```

> **Regla v5.0 heredada (NO romper):** usar listeners incrementales
> (`child_added/changed/removed`), nunca `once('value')` sobre sesiones completas — causa
> regresión de ancho de banda. El `FirebaseProvider` debe respetarlo.

### Migración entre proveedores (admin, F5)
`exportAll()` (streaming, paginado) del provider origen → `importAll()` del destino, con
**adaptador de esquema** y reporte de validación (`zod`). Soporta también **importar una DB
externa desde archivo** (se mapea al esquema v6 vía adaptadores en `packages/shared`).

---

## 4. Arquitectura de adquisición offline-first (agente Tauri)

```
serial (USB) ─▶ parser (4 formatos: CosmicWatch/JSON/KV/CSV)
            ─▶ escritura inmediata en SQLite local (capa 1, fuente de verdad del borde)
            ─▶ cola de sync: marca registros no confirmados
            ─▶ uploader: DataProvider.pushMinuteRecord/​pushRealtime con reintentos
                          • backoff exponencial si no hay red
                          • idempotencia por (detectorId, ts) → evita duplicados
                          • al reconectar, sube lo adelantado vs la nube y reconcilia
```

- **Idempotencia:** clave natural `(detectorId, ts_minuto)`. Reenviar el mismo minuto no
  duplica. La reconciliación compara timestamps locales vs nube y sube solo lo faltante.
- **El parser y los formatos se portan desde `serial-reader.js` v5.0** (lógica probada con
  hardware real), reescritos en Rust/TS dentro del agente. NO reinventar la detección de
  formatos; preservar el comportamiento validado.
- **Web Serial sigue disponible** como camino rápido en Chromium para usuarios casuales,
  pero el agente es el camino recomendado (offline + multiplataforma + respaldo local).

---

## 5. Redundancia de datos — 3 capas (prioridad #1)

| Capa | Qué | Dónde | Frecuencia |
|------|-----|-------|-----------|
| 1 | Respaldo local | SQLite en cada PC de detector (agente) | Tiempo real |
| 2 | DB primaria | Firebase munhub-1 (Fase A) → Supabase/Postgres (Fase B) | Tiempo real |
| 3 | Respaldo frío | Cloudflare R2 (dumps comprimidos) | Job programado (diario/semanal) |

- El job de respaldo frío (F5) usa `DataProvider.exportAll()` → archivo comprimido + checksum
  → sube a R2 con retención rotativa. Restaurable vía `importAll()`.
- **Evolución futura:** réplica activa Postgres (primario+réplica) cuando haya servidores
  Red Clara (no en F1–F5).

---

## 6. Seguridad y multi-tenant

- **Auth:** Firebase Auth (Fase A) → Supabase Auth (Fase B), ambos detrás del `DataProvider`.
- **Roles:** leídos de DB (`users/{uid}.role`: `admin | institution_admin | user | guest`),
  nunca hardcodeados. Primer admin se configura manual.
- **Tenancy híbrida:** `institution → users → detectors` + usuarios independientes
  (institution_id nullable). Ver `02-DATA-MODEL.md`.
- **Reglas (deny-by-default):**
  - Detector público → lectura para cualquiera.
  - Detector privado → dueño, usuarios compartidos, admin de su institución, admin global.
  - Usuario solo lee/escribe su propia cuenta.
  - En Fase B esto se traduce a **RLS de Postgres** (políticas por fila).
- **Secretos:** `private/` y `.env` fuera del repo (`.gitignore`); `.env.example` documenta
  variables sin valores. Service accounts inyectados por entorno en producción.

---

## 7. Fase A (Firebase) vs Fase B (Supabase) — qué cambia

| Aspecto | Fase A (puente) | Fase B (servidor propio) |
|---------|-----------------|--------------------------|
| DB | Firebase Realtime DB (munhub-1) | Postgres + TimescaleDB |
| Auth | Firebase Auth | Supabase Auth |
| Realtime | listeners Firebase | Supabase Realtime / WS |
| Storage | Firebase Storage | Supabase Storage |
| Reglas | `database.rules.json` | RLS Postgres |
| Hosting | **Firebase Hosting (Spark, gratis) + Next.js static export** | Servidor Red Clara (Docker, SSR completo) |
| Lo que NO cambia | **toda la app**: vive sobre `DataProvider`. Solo se cambia la implementación + esquema adaptado. |

> **Hosting Fase A (D18) — billing-proof.** Next.js con `output: 'export'` (SSG en build →
> SEO del landing; datos dinámicos vía SDK cliente de Firebase). Se sirve en Firebase Hosting
> plan **Spark (gratis)**, que **bloquea al exceder cuota, no cobra**. **Evitar App
> Hosting/Blaze** salvo necesidad real; si se activa Blaze, configurar **budget alerts +
> cuotas**. Dominio propio se conecta gratis a Firebase Hosting cuando se decida. La Fase B
> (Red Clara) habilita SSR en tiempo de request; la app no cambia (vive sobre el router de Next).

---

## 8. CI/CD y calidad

- **Monorepo:** pnpm workspaces + Turborepo (build/test/lint cacheados por paquete).
- **GitHub Actions:** lint + typecheck + tests en cada PR; deploy en merge a `main`.
- **Calidad:** TypeScript estricto, ESLint + Prettier, tests (Vitest) — al menos en
  `packages/physics` (cálculos científicos) y `packages/data-provider` (contratos).
- **Idioma del código = inglés (D28):** identificadores, comentarios, commits, esquema de DB,
  nombres de API y claves i18n en inglés (source locale). Considerar una regla de lint/CI que
  marque texto no-inglés en código. es/pt-BR son solo traducciones de la UI.
- **Tests científicos:** `packages/physics` con casos de referencia verificables (p. ej.
  corrección barométrica contra valores conocidos del reporte teórico).

---

## 9. ADRs clave (registro corto)

> Formato: contexto → decisión → consecuencia. Las grandes ya están en la tabla D1–D17 del
> plan maestro; aquí se anotan las que necesitan más matiz. Cada ADR nuevo va como archivo en
> `docs/technical/adr/NNN-titulo.md` cuando se implemente.

- **ADR-001 Capa de datos agnóstica** → permite Firebase↔Supabase y ES la herramienta de
  migración. Consecuencia: toda feature debe escribirse contra la interfaz, nunca contra el SDK.
- **ADR-002 Agente Tauri como borde de confianza** → resuelve serial multiplataforma +
  offline + respaldo local. Consecuencia: el parser serial es lógica compartida y crítica;
  se porta, no se reescribe a ciegas.
- **ADR-003 Plotly para charts científicos** → escala log, error bars, export. Consecuencia:
  componentes envueltos en `packages/ui` para estilo y i18n consistentes.
- **ADR-004 Metadatos obligatorios con compatibilidad hacia atrás** → datos viejos se
  importan sin metadatos y se solicita completarlos sin bloquear. Ver `02-DATA-MODEL.md`.

---

## 10. Lo que se PRESERVA de la v5.0 (no reinventar)

- Detección de los 4 formatos serial (CosmicWatch/JSON/KV/CSV) — probada con hardware real.
- Invariante "promedios nunca sumas" + sin filtrado de eventos.
- Listeners incrementales (no `once('value')`).
- Detección de gaps (≥2 min rompe la línea) y auto-expiry de realtime (>8 min).
- Esquema de campos por minuto: `ec, cc, sm, sx, sn, tp, pr, d`.
