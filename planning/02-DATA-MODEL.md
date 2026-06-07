# MunHub Lab v6.0 — Modelo de datos y migración

> Depende de: [`00-MASTER-PLAN.md`](00-MASTER-PLAN.md), [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md).
> Define el esquema canónico v6 (modelo de **dos niveles: Estación + Detector**, D21), su mapeo
> a Firebase (Fase A) y Postgres/TimescaleDB (Fase B), los metadatos obligatorios, y la
> migración v5→v6 con compatibilidad hacia atrás.
> **Principio rector (D23):** mientras más informativo, configurable y ajustable, mejor.
> Guardar **todos los metadatos posibles**; exponer ajustes avanzados sin estorbar el flujo básico.

---

## 1. Vocabulario (resuelve la colisión "detector aparato" vs "Detector perfil")

| Término v6 | Qué es | Era en v5 |
|---|---|---|
| **Institución** | Universidad/organización que agrupa usuarios y estaciones | organization |
| **Usuario** | Cuenta de persona | user |
| **Estación** | El **perfil/sitio** registrado: ubicación, metadatos, visibilidad. Lo que sale en el mapa y tiene dueño/institución. | profile |
| **Detector** | El **dispositivo físico** CosmicWatch dentro de una estación: device token, firmware, calibración. Los DATOS van por detector. | (no existía aparte) |
| **Sesión** | Una corrida de toma de datos de un detector | session |

> "Detector" ahora SIEMPRE significa el aparato físico. "Estación" es el perfil.

---

## 2. Entidades y relaciones

```
Institución 1 ── N Usuario        (institution_id en Usuario, NULLABLE → independiente)
Institución 1 ── N Estación       (institution_id en Estación, NULLABLE)
Usuario     1 ── N Estación       (owner_uid; + station_shares para compartir)
Estación    1 ── N Detector       (normalmente 1; varios con aviso de consistencia)
Detector    1 ── N Sesión
Detector    1 ── N MinuteRecord   (serie temporal, retención indefinida)
Detector    1 ── N RealtimeRecord (ventana corta, expira)
Detector    1 ── 1 LatestRecord
ExternalEvent (global, de APIs)   (NMDB, NOAA, DONKI, Dst/Kp)
AiInsight   N ── 1 Detector/Estación (resultados ML, Fase 7)
```

- Los **datos (sesiones, minutos, realtime) cuelgan del Detector** (porque la calibración es
  por dispositivo). Para una estación de 1 detector (caso 99%) es 1:1 y la UI lo muestra
  transparente. La **vista de Estación agrega** sus detectores.
- Una **Estación de coincidencia** (telescopio de muones) = una estación con ≥2 detectores
  (futuro; el esquema ya lo soporta).

---

## 3. Metadatos (OBLIGATORIOS marcados ✓; el resto, opcional pero deseable)

### Estación (sitio/perfil)
| Campo | Tipo | Oblig. | Nota |
|-------|------|--------|------|
| name | string | ✓ | nombre legible |
| owner_uid | string | ✓ | dueño |
| institution_id | string\|null | — | null = independiente |
| **visibility** | enum(public/institution/private) | ✓ | **elección obligatoria al crear, SIN default** (D22, D24) |
| ml_training_opt_out | bool | — | excluir esta estación del entrenamiento ML (default: usar pref. del usuario) |
| embargo_until | date\|null | — | privado hasta esta fecha, luego público (capacidad opcional) |
| **latitude** | number | ✓ | grados decimales (ingreso **manual**, no geolocalización) |
| **longitude** | number | ✓ | grados decimales (manual) |
| **altitude_m** | number | ✓ | msnm (clave para el flujo) |
| city | string | ✓ | (define la burbuja del mapa, D20) |
| country | string ISO-3166 | ✓ | |
| **placement** | enum(ground/indoor/basement/underground/outdoor/rooftop) | ✓ | afecta blindaje |
| **type** | enum(single/coincidence) | ✓ | tipo de estación |
| timezone | string IANA | ✓ | análisis diurno |
| floor, shielding, orientation, notes | varios | — | cuanto más, mejor (D23) |

### Detector (dispositivo físico)
| Campo | Tipo | Oblig. | Nota |
|-------|------|--------|------|
| id, station_id | — | ✓ | pertenece a una estación |
| label | string | — | "principal", "superior", etc. |
| **device_token** | string | ✓ (autogenerado) | identidad del aparato; **no estorba el registro**; visible en ajustes avanzados; habilita el aviso de "dispositivo distinto" |
| **hardware_model** | string | ✓ | p.ej. "CosmicWatch v2" |
| **firmware_version** | string | ✓ | guardar todo lo posible |
| hw_version | enum(v2/v3X/…) | ✓ | define **τ_DT** (v2≈50 ms, v3X≈400 µs) |
| sipm_count | int | ✓ | 1 por defecto |
| **calibration** | objeto | — | `{ adc_to_mv:[…], saturation_mv, trigger_adc_min }`. **Defaults por hw_version**; **edición avanzada opcional** + botón "volver a defaults" |
| status | enum(active/inactive) | ✓ | |

> **Compatibilidad hacia atrás (ADR-004):** estaciones/usuarios v5 sin metadatos se importan
> igual (null) y la app muestra una **notificación no intrusiva** para completarlos. Solo se
> exigen en **altas nuevas**. La migración crea automáticamente **un Detector** por cada
> perfil v5 con defaults + token generado.

> **Aviso de consistencia (caso device token):** si llega data con un device_token distinto al
> registrado en un Detector (o se comparte edición y se conecta otro aparato), la app avisa:
> "no recomendamos mezclar dispositivos; la calibración puede diferir y afectar la consistencia;
> te sugerimos crear una nueva estación/detector". Si el usuario continúa, el Detector queda con
> varios aparatos registrados (trazable).

---

## 4. Registros de serie temporal (núcleo científico) — por Detector

### MinuteRecord (retención indefinida) — **promedios, NUNCA sumas**
| Campo | Unidad | Descripción |
|-------|--------|-------------|
| ts | epoch ms | inicio del minuto |
| ec | conteo/min | tasa de eventos (partículas cargadas) |
| cc | conteo/min | coincidencias/min (solo significativo en `type=coincidence`) |
| sm / sx / sn | mV | amplitud SiPM prom/máx/mín (el firmware ya entrega mV) |
| tp | °C | temperatura |
| pr | hPa | presión atmosférica |
| dt | % | tiempo muerto |
| *(derivados — `packages/physics`)* | | |
| ec_dt | conteo/min | corregida por tiempo muerto: `R/(1−R·τ_DT)` |
| ec_corr | conteo/min | corregida por presión (sobre `ec_dt`), **β LOCAL por regresión** |
| flux | 1/cm²/min | si hay área efectiva configurada |

> **Pipeline (orden obligatorio):** cruda → tiempo muerto → barométrica (β local) → térmica.
> Ver `docs/research/THEORETICAL-FOUNDATION.md` §4 y §8.

### RealtimeRecord (ventana corta, expira)
Por evento: `ts`, `sipm_mv`, `temp`, `deadtime`, … Retención 8 min (tope 5000 en Firebase;
retention policy en Postgres).

> **Inconsistencias v5 reconciliadas en `packages/shared`:** dead time canónico = **`dt`**
> (no `d`); presión en **hPa**; `cc` = coincidencias (no "muones", ver §7).
> **Invariantes NO negociables:** promedios nunca sumas; sin filtrado de eventos; gaps ≥2 min
> rompen línea; realtime >8 min → auto-expiry. Validados con `zod` en `packages/shared`.

---

## 5. Esquema Fase A — Firebase (munhub-1)

```
/users/{uid}                       → role, displayName, email, institution_id, country, language
/institutions/{id}                 → name, country, city, admin_uids, website, logo_url
/stations/{id}                     → owner_uid, institution_id, visibility, embargo_until,
  │                                   latitude, longitude, altitude_m, city, country,
  │                                   placement, type, timezone, floor, shielding, notes,
  │                                   shares/{uid}: 'view'|'edit'
  └─ detectors/{detId}             → device_token, hardware_model, firmware_version,
       │                              hw_version, sipm_count, calibration{…}, status
       ├─ sessions/{sid}/minutes/{ts}
       ├─ realtime/{ts}            (.indexOn ts)
       └─ latest
/external_events/{source}/{id}     → cache de APIs externas
```
Reglas: deny-by-default; `stations` public/unlisted legibles por cualquiera; privado solo
dueño/compartido/admin de institución/admin global (ver `05`).

## 6. Esquema Fase B — Postgres + TimescaleDB

```sql
institutions(id pk, name, country, city, website, logo_url, created_at)
users(uid pk, email, display_name, role, institution_id fk null, country, language, created_at)
stations(id pk, name, owner_uid fk, institution_id fk null, visibility, embargo_until,
         latitude, longitude, altitude_m, city, country, placement, type, timezone,
         floor, shielding, orientation, notes, created_at)
station_shares(station_id fk, uid fk, permission)
detectors(id pk, station_id fk, label, device_token, hardware_model, firmware_version,
          hw_version, sipm_count, calibration jsonb, status, added_at)
sessions(id pk, detector_id fk, started_at, ended_at, source_file_hash)

-- Hypertables TimescaleDB
minute_records(detector_id fk, ts timestamptz, ec, cc, sm, sx, sn, tp, pr, dt,
               ec_dt, ec_corr, flux)        -- PK (detector_id, ts) → hypertable
realtime_records(detector_id fk, ts timestamptz, sipm_mv, temp, deadtime, …)  -- + retención
external_events(id pk, source, kind, ts, payload jsonb, fetched_at)
ai_insights(id pk, station_id fk null, detector_id fk null, kind, ts_range, result jsonb,
            model_version, confidence)
```
- TimescaleDB: hypertables + continuous aggregates (hora/día) para charts de rango largo.
- RLS por fila equivalente a las reglas Fase A. Índices `(detector_id, ts)` + geoespacial
  (lat/lon) para el mapa.

---

## 7. Nota científica sobre `cc`/"muones" (honestidad, D7/D9)

Un solo SiPM NO distingue muón/electrón/gamma (todos MIP ~2 MeV — `THEORETICAL-FOUNDATION.md`
§5). Por tanto:
- Estación `type=single`: métrica principal = **"Tasa integral de partículas cargadas /
  tipo-MIP"**, NO "muones". Mostrar **espectro de amplitud (Landau, MPV)**. La dominancia
  muónica (75–80% a nivel del mar) es solo **agregada** y **baja en altitud** (Andes).
- Estación `type=coincidence`: `cc` sí es selección de muones (>99% pureza) + direccionalidad.
- La UI toma los textos exactos del reporte teórico para tooltips.

---

## 8. Migración v5 → v6

1. **Export v5:** leer `/profiles`, `/users`, `/organizations` del Firebase v5 **`munra-1`**
   (service account en `private/munra-1-firebase-adminsdk-*.json`), o de un dump.
   ⚠️ **Confirmar primero que `munra-1` es legible** (riesgo R1 en `08-RISKS`).
2. **Transformar** (adaptador en `data-provider`/`shared`):
   - `profile → Estación` (+ metadatos null) **+ crear un Detector** con defaults de calibración
     por hw_version + `device_token` generado.
   - `organization → Institución`; `sharedWith → station_shares`.
   - Normalizar: `d→dt`, presión a hPa; validar con `zod` (cuarentena lo inválido).
   - Mover `sessions/minutes`, `realtime`, `latest` bajo el Detector creado.
3. **Cargar** vía `DataProvider.importAll()` (destino: munhub-1 en Fase A).
4. **Reporte:** filas migradas, en cuarentena, estaciones sin metadatos (→ notificación).
5. **Idempotente y reanudable** (clave natural `(detector_id, ts)`).

> La misma maquinaria **importa una DB externa desde archivo** (admin, F5) vía un adaptador de
> entrada que mapea el formato externo al esquema v6.

---

## 9. Retención y rendimiento

| Dato | Retención | Mecanismo |
|------|-----------|-----------|
| minute_records | Indefinida | hypertable + continuous aggregates |
| realtime_records | 8 min | retention policy / tope 5000 (Firebase) |
| external_events | Configurable (~2 años) | job de limpieza |
| respaldos fríos | Rotación (30 diarios + 12 mensuales) | job → Cloudflare R2 |

Charts de rango largo: continuous aggregates (Fase B); LTTB máx 500 pts (Fase A).

---

## 10. Entidades de ecosistema y campos de cuenta

**Usuario (campos clave, D25):** `uid`, `email` (único), **`username` (único)**, `display_name`,
`role`, `institution_id` (null), `country`, `language`, `email_verified` (bool),
`ml_training_opt_out` (bool, default false), `directory_opt_in` (bool, buscable por username).

**Institución:** `id`, `name`, `country`, `city`, `admin_uids`, `website`, `logo_url`,
`default_station_visibility` (sugerida).

**Redes de estaciones (D27, ver `14`):**
- `networks(id, name, description, owner_uid, institution_id null, visibility, created_at)`
- `network_stations(network_id, station_id)`  — N:N

**Compartición (ya referida):** `station_shares(station_id, uid|institution_id, permission[viewer|editor])`.

**Soporte y notificaciones (ver `12`):**
- `support_tickets(id, user_uid, category, status, subject, context jsonb, created_at, updated_at)`
- `ticket_messages(id, ticket_id, author_uid, body, attachments, created_at)`
- `notifications(id, user_uid, type, payload jsonb, read_at, created_at)`
- `notification_prefs(user_uid, type, channel, frequency)`

**Administración (ver `15`):**
- `audit_log(id, actor_uid, action, resource_type, resource_id, diff jsonb, ip, created_at)` — append-only.
- `feature_flags(key, enabled, scope)`; `announcements(id, body, audience, starts_at, ends_at)`.

**Monetización — solo ganchos, sin cobro (D26, ver `13`):**
- `plans(id, name, limits jsonb)`; `entitlements(subject_type, subject_id, plan_id, valid_until)`
- `usage_events(id, subject_type, subject_id, kind, amount, ts)` — metering (observación).

> Todas estas entidades respetan deny-by-default, RLS/rules y el audit log. La mayoría son de
> fases F4–F7; el esquema base (username, visibility institucional, consentimiento ML,
> entitlements) se incluye desde F1 para no migrar después.
