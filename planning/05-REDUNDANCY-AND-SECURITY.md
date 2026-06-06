# MunHub Lab v6.0 — Redundancia y Seguridad

> Depende de: `00`–`02`. **Prioridad #1 del sistema: la seguridad de los datos.**
> Cubre EPIC-9 (S35–S38) y refuerza EPIC-3/8. Lectura obligatoria para ing. DB y seguridad.

---

## 1. Modelo de redundancia de 3 capas

| Capa | Qué | Dónde | Cuándo | Falla que cubre |
|------|-----|-------|--------|-----------------|
| **1. Borde** | Respaldo local | SQLite en cada PC de detector (agente Tauri) | Tiempo real, antes de subir | Caída de internet, de la nube, o de la plataforma (mantenimiento/actualización) |
| **2. Primaria** | DB en línea | Firebase munhub-1 → Supabase/Postgres | Tiempo real | Pérdida del PC local; acceso global |
| **3. Fría** | Respaldos comprimidos | Cloudflare R2 | Job programado (diario + semanal/mensual) | Corrupción/borrado de la primaria; proveedor caído |

**Principio:** ningún dato existe en una sola copia. El borde es la fuente de verdad local;
la primaria es la fuente de verdad compartida; la fría es el seguro.

### Escenarios de recuperación (DR)
- **Internet caído en el sitio:** el agente sigue grabando en SQLite; al volver la red,
  sincroniza lo adelantado (idempotente por `(detector, ts)`).
- **Plataforma en mantenimiento/actualización:** igual que arriba; el borde no depende de la
  web para grabar.
- **Corrupción/borrado en la primaria:** restaurar desde el último respaldo frío (R2) +
  re-sincronizar desde los SQLite locales (que pueden estar más adelantados).
- **Migración de proveedor:** `exportAll → importAll` (ver `01-ARCH §3`), con verificación.

---

## 2. Respaldos fríos (S35/S36)

- **Generación:** job programado usa `DataProvider.exportAll()` (streaming, paginado) →
  archivo comprimido (gzip/zstd) + **checksum (SHA-256)** + manifiesto (rango, conteo, versión).
- **Destino:** Cloudflare R2 (S3-compatible). Bucket privado; credenciales por entorno.
- **Rotación:** p. ej. 30 diarios + 12 mensuales (configurable). Limpieza automática.
- **Restauración:** verificar checksum → `importAll()` al destino → reporte de filas.
- **Prueba de restauración:** job periódico que valida que el último respaldo es restaurable
  (restore-to-temp + conteo), no solo que existe. Un respaldo no probado no cuenta.

---

## 3. Verificación de integridad (S38)

- **Idempotencia y deduplicación** por clave natural `(detector_id, ts_minuto)`.
- **Detección de gaps** (≥2 min) — ya existe en v5; se reporta, no se rellena con inventos.
- **Checksums** en respaldos; **conteos cruzados** local vs primaria vs frío.
- **Cuarentena** de registros que fallan validación `zod` (no se descartan: se aíslan para
  revisión).
- **Invariantes científicos** (promedios nunca sumas; sin filtrado de eventos) validados al
  escribir.

---

## 4. Autenticación y autorización

- **Auth:** Firebase Auth (Fase A) → Supabase Auth (Fase B), detrás del `DataProvider`.
- **Roles** (de DB, nunca hardcodeados): `admin` (global), `institution_admin` (su
  institución), `user`, `guest`.
- **Tenancy híbrida:** Institución→Usuarios→Detectores + usuarios independientes.
- **Matriz de permisos (resumen):**

| Acción | guest | user (dueño) | institution_admin | admin |
|--------|:----:|:----:|:----:|:----:|
| Ver detector público | ✓ | ✓ | ✓ | ✓ |
| Ver/editar detector propio | — | ✓ | ✓ (de su institución) | ✓ |
| Compartir detector | — | ✓ | ✓ | ✓ |
| Gestionar usuarios de su institución | — | — | ✓ | ✓ |
| Consola admin / migración DB | — | — | — | ✓ |

---

## 5. Reglas / RLS (deny-by-default)

- **Fase A (Firebase rules):** portar v5 con renombres (`profiles→detectors`,
  `organizations→institutions`); lectura pública solo para detectores `public`/`unlisted`;
  todo lo demás denegado salvo dueño/compartido/admin.
- **Fase B (Postgres RLS):** una política por tabla y acción equivalente a las reglas. Nada
  legible/escribible sin política explícita.
- **Tests de reglas:** suite que verifica accesos permitidos y **denegados** (casos negativos).

---

## 6. Manejo de secretos

- `private/` (service account munhub-1) y `.env` → en `.gitignore`. **Nunca commitear.**
- `.env.example` documenta variables sin valores reales.
- En producción: inyección por variables de entorno / secret manager del servidor.
- Rotación de claves documentada; claves del cliente Firebase (apiKey web) no son secretas
  pero el acceso lo limitan las reglas.

---

## 7. Amenazas consideradas (resumen)

| Amenaza | Mitigación |
|---------|-----------|
| Borrado/corrupción de datos | 3 capas + respaldos probados + cuarentena |
| Acceso no autorizado | deny-by-default + roles de DB + tests negativos |
| Fuga de secretos | secretos fuera del repo + rotación |
| Suplantación de detector (datos falsos) | autenticación del agente; clave por detector (futuro) |
| Pérdida de proveedor (Firebase/R2) | capa agnóstica + respaldo en proveedor distinto |
| Inyección de datos inválidos | validación `zod` + idempotencia + invariantes |

> **Evolución (post Red Clara):** réplica activa Postgres (primario+réplica) y, si aplica,
> firma/clave por detector para autenticidad de los datos enviados.
