# MunHub Lab v6.0 — Modelo de datos y migración

> Depende de: [`00-MASTER-PLAN.md`](00-MASTER-PLAN.md), [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md).
> Define el esquema canónico v6, su mapeo a Firebase (Fase A) y Postgres/TimescaleDB
> (Fase B), los metadatos obligatorios, y la migración v5→v6 con compatibilidad hacia atrás.

---

## 1. Esquema v5.0 actual (punto de partida)

```
/users/{uid}                         → role (admin|user|guest), displayName, email
/profiles/{profileId}
  ├─ ownerUid, visibility(private|public), sharedWith/{uid}: 'edit'|...
  ├─ sessions/{sid}/minutes/{ts}     → ec, cc, sm, sx, sn, tp, pr, d/dt  (promedios)
  ├─ realtime/{ts}                   → registros por evento (ventana 8 min, tope 5000)
  └─ latest                          → último punto
/organizations/{orgId}               → owner, members/{uid}
```

**Inconsistencias detectadas (reconciliar en v6 — fuente única en `packages/shared`):**

| Campo | v5 (CLAUDE.md) | v5 (config.js) | Decisión v6 |
|-------|----------------|----------------|-------------|
| Dead time | `d` | `dt` (label "Dead Time %") | **`dt`** (canónico); migración acepta ambos |
| Presión | `pr` "Pa" | CHART_INFO dice "hPa" | **`pr` en hPa** (la corrección barométrica usa hPa) |
| `cc` | "coincidences/min" | label "Muons/min" | **`cc` = coincidencias/min**; "muones" solo si hay coincidencia real (ver §7) |

---

## 2. Entidades v6 y relaciones

```
Institution 1 ──── N User           (institution_id en User, NULLABLE → usuario independiente)
Institution 1 ──── N Detector       (institution_id en Detector, NULLABLE)
User        1 ──── N Detector       (owner_uid; + tabla detector_shares para compartir)
Detector    1 ──── N Session
Detector    1 ──── N MinuteRecord   (serie temporal, retención indefinida)
Detector    1 ──── N RealtimeRecord (ventana corta, expira)
Detector    1 ──── 1 LatestRecord
ExternalEvent (global, de APIs)     (NMDB, NOAA, DONKI, Dst/Kp)
AiInsight    N ──── 1 Detector      (resultados del pipeline ML, Fase 7)
```

> Nota: "perfil" (v5) = "detector" (v6). Un detector ES un perfil con metadatos físicos.
> "organization" (v5) = "institution" (v6).

---

## 3. Metadatos OBLIGATORIOS (para estadística valiosa)

### Detector
| Campo | Tipo | Oblig. | Nota |
|-------|------|--------|------|
| name | string | ✓ | nombre legible |
| owner_uid | string | ✓ | dueño |
| institution_id | string\|null | — | null = independiente |
| visibility | enum(public/private/unlisted) | ✓ | |
| **latitude** | number | ✓ | grados decimales |
| **longitude** | number | ✓ | grados decimales |
| **altitude_m** | number | ✓ | msnm (clave para flujo) |
| city | string | ✓ | |
| country | string (ISO-3166) | ✓ | |
| **placement** | enum(ground/indoor/basement/underground/outdoor/rooftop) | ✓ | afecta blindaje |
| floor | int\|null | — | piso |
| shielding | string\|null | — | descripción de blindaje |
| **hardware_model** | string | ✓ | p.ej. "CosmicWatch v2" |
| **detector_type** | enum(single/coincidence) | ✓ | single = 1 SiPM |
| sipm_count | int | ✓ | 1 por defecto |
| orientation | string\|null | — | |
| timezone | string (IANA) | ✓ | para análisis diurno |
| notes | text\|null | — | |

### User
| Campo | Oblig. | Nota |
|-------|--------|------|
| uid, email, display_name | ✓ | |
| role | ✓ | admin\|institution_admin\|user\|guest |
| institution_id | — | null = independiente |
| country | ✓ | |
| preferred_language | ✓ | es\|en\|pt-BR |

### Institution
| Campo | Oblig. | Nota |
|-------|--------|------|
| id, name | ✓ | |
| country, city | ✓ | |
| admin_uids | ✓ | quién la administra |
| website, logo_url | — | para landing |

> **Compatibilidad hacia atrás (D17/ADR-004):** detectores/usuarios v5 sin estos campos se
> importan igual (campos null). La app muestra una **notificación no intrusiva** ("Completa
> los metadatos de tu detector para habilitar estadísticas avanzadas") que NO bloquea el flujo.
> Los campos solo son obligatorios en **altas nuevas** (validación `zod` en formularios).

---

## 4. Registros de serie temporal (núcleo científico)

### MinuteRecord (retención indefinida) — **promedios, NUNCA sumas**
| Campo | Unidad | Descripción |
|-------|--------|-------------|
| ts | epoch ms | inicio del minuto |
| ec | conteo/min | tasa de eventos (partículas cargadas) |
| cc | conteo/min | coincidencias/min (solo significativo si detector_type=coincidence) |
| sm | mV | amplitud SiPM promedio |
| sx | mV | amplitud SiPM máx |
| sn | mV | amplitud SiPM mín |
| tp | °C | temperatura |
| pr | hPa | presión atmosférica |
| dt | % | tiempo muerto |
| *(v6 nuevos, calculados — `packages/physics`)* | | |
| ec_dt | conteo/min | tasa **corregida por tiempo muerto**: `R/(1−R·τ_DT)` (τ_DT según hardware: v2≈50 ms, v3X≈400 µs) |
| ec_corr | conteo/min | tasa corregida por presión (sobre `ec_dt`), con **β LOCAL por regresión** (no universal) |
| flux | 1/cm²/min | flujo si hay área efectiva configurada |

> **Pipeline de corrección (orden obligatorio):** cruda → tiempo muerto (`ec_dt`) →
> barométrica (`ec_corr`, β local) → (opcional) térmica. Ver `docs/research/THEORETICAL-FOUNDATION.md`
> §4 y §8. Omitir el tiempo muerto causa subestimación sistemática (grave en sitios andinos).

### RealtimeRecord (ventana corta, expira)
- Por evento: `ts`, `adc/sipm_mv`, `temp`, `deadtime`, etc.
- Retención: 8 min (config v5). Tope 5000 (Firebase). En Postgres: política de retención.

> **Invariantes NO negociables:** valores por minuto siempre promedios; sin filtrado de
> eventos; gaps ≥2 min rompen línea; realtime >8 min → auto-expiry. Validados en `shared`.

---

## 5. Esquema Fase A — Firebase (munhub-1)

Mantiene estructura v5 extendida (mínima fricción para desplegar ya):
```
/users/{uid}                  → + institution_id, country, preferred_language
/institutions/{id}            → (renombre de organizations) name, country, admin_uids, …
/detectors/{id}               → (renombre de profiles) + metadatos §3
  ├─ sessions/{sid}/minutes/{ts}
  ├─ realtime/{ts}            (.indexOn ts)
  └─ latest
/external_events/{source}/{id}  → cache de APIs externas
```
Reglas: portar `database.rules.json` v5 con los renombres + lectura pública de detectores
public/unlisted, deny-by-default en el resto (ver `01-ARCHITECTURE.md` §6).

## 6. Esquema Fase B — Postgres + TimescaleDB

```sql
-- Entidades relacionales
institutions(id pk, name, country, city, website, logo_url, created_at)
users(uid pk, email, display_name, role, institution_id fk null, country,
      preferred_language, created_at)
detectors(id pk, name, owner_uid fk, institution_id fk null, visibility,
          latitude, longitude, altitude_m, city, country, placement, floor,
          shielding, hardware_model, detector_type, sipm_count, orientation,
          timezone, notes, created_at)
detector_shares(detector_id fk, uid fk, permission)   -- compartir
sessions(id pk, detector_id fk, started_at, ended_at, source_file_hash)

-- Hypertables TimescaleDB (particionadas por tiempo)
minute_records(detector_id fk, ts timestamptz, ec, cc, sm, sx, sn, tp, pr, dt,
               ec_corr, flux)            -- PK (detector_id, ts)  → hypertable
realtime_records(detector_id fk, ts timestamptz, sipm_mv, temp, deadtime, …)
                                          -- hypertable + retention policy 8 min
external_events(id pk, source, kind, ts, payload jsonb, fetched_at)
ai_insights(id pk, detector_id fk, kind, ts_range, result jsonb, model_version)
```
- **TimescaleDB:** `minute_records` y `realtime_records` como *hypertables*; continuous
  aggregates para vistas por hora/día (acelera charts de rangos largos sin LTTB pesado).
- **RLS:** políticas por fila equivalentes a las rules de Fase A.
- **Índices:** `(detector_id, ts)`; índices geoespaciales (lat/lon) para el mapa del landing.

---

## 7. Nota científica sobre `cc`/"muones" (honestidad, D7/D9)

Un solo SiPM NO distingue muón/electrón/gamma (todos son MIP, ~2 MeV — ver
`THEORETICAL-FOUNDATION.md` §5). La v6 debe:
- Para `detector_type=single`: la métrica principal se llama **"Tasa integral de partículas
  cargadas" / "tasa de eventos tipo-MIP"**, NO "muones". Mostrar también el **espectro de
  amplitud (Landau, MPV)**. La dominancia muónica (75–80% a nivel del mar) es solo **agregada**
  y **disminuye en altitud** (Andes) → declararlo, no etiquetar eventos individuales como muón.
- Para `detector_type=coincidence`: `cc` sí es selección de muones (>99% pureza) y permite
  direccionalidad.
- La UI toma los textos exactos de `docs/research/THEORETICAL-FOUNDATION.md` para tooltips.

---

## 8. Migración v5 → v6

1. **Export v5:** leer `/profiles`, `/users`, `/organizations` del Firebase v5 **`munra-1`**
   (service account en `private/munra-1-firebase-adminsdk-*.json`), o de un dump exportado.
2. **Transformar** (adaptador en `packages/data-provider` / `shared`):
   - `profiles → detectors` (+ metadatos null), `organizations → institutions`,
     `sharedWith → detector_shares`.
   - Normalizar campos: `d→dt`, presión a hPa, validar con `zod` (cuarentena lo inválido).
3. **Cargar** vía `DataProvider.importAll()` al destino (Firebase munhub-1 en Fase A).
4. **Reporte de migración:** filas migradas, en cuarentena, detectores sin metadatos
   (→ disparan la notificación de completar).
5. **Idempotente y reanudable:** re-ejecutar no duplica (clave natural `(detector, ts)`).

> Misma maquinaria sirve para **importar una DB externa desde archivo** (admin, F5): se
> escribe un adaptador de entrada que mapea el formato externo al esquema v6.

---

## 9. Retención y rendimiento

| Dato | Retención | Mecanismo |
|------|-----------|-----------|
| minute_records | Indefinida | hypertable + continuous aggregates (hora/día) |
| realtime_records | 8 min | retention policy (Postgres) / tope 5000 (Firebase) |
| external_events | Configurable (p. ej. 2 años) | job de limpieza |
| respaldos fríos | Rotación (p. ej. 30 dailies + 12 monthlies) | job → Cloudflare R2 |

- Charts de rango largo: usar continuous aggregates en Fase B; LTTB (máx 500 pts) en Fase A.
