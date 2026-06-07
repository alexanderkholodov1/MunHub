# MunHub Lab v6.0 — Operación, Observabilidad y Gobernanza de Datos

> Depende de: `01`, `05`. Dos partes: (A) cómo operamos y observamos el sistema en producción;
> (B) cómo se gobiernan los datos en una red internacional multi-universidad.

---

# Parte A — Observabilidad y operación

## A1. Principios
- "Si no se puede observar, no se puede operar." Toda la plataforma emite logs estructurados,
  métricas y errores; los fallos se detectan antes de que los reporte un usuario.
- Empezar simple y barato (compatible con Firebase ahora y Red Clara después).

## A2. Logging
- **Estructurado (JSON)** con niveles, en web, api, agente y jobs de IA.
- `correlation_id` por petición/sincronización para rastrear extremo a extremo.
- El agente local guarda logs rotados localmente (diagnóstico aunque esté offline).

## A3. Error tracking
- Captura centralizada de excepciones (frontend y backend). Opción autoalojable y gratuita
  (p. ej. **GlitchTip/Sentry self-hosted**) para no depender de servicios de pago y poder
  correr en Red Clara. En Fase A puede empezar con logging + un panel simple.

## A4. Métricas y health checks
- **Salud del sistema:** endpoints `/health` (web/api), estado de la DB, estado de los jobs.
- **Salud de la red:** nº estaciones activas/inactivas, último dato por detector, latencia
  de sincronización, detectores con gaps. (Reutiliza el estado del mapa S23, agregado por ciudad.)
- **Métricas de datos:** filas/min ingeridas, tasa de cuarentena, uso de almacenamiento
  (vigila el límite de Firebase — ver R4).

## A5. Alertas
- Disparadores: caída de un detector clave, fallo de job de respaldo (¡crítico!), error de
  migración, uso de almacenamiento sobre umbral, tasa de errores elevada.
- Canal: email/webhook al admin. Sin ruido: agrupar y limitar.

## A6. Runbooks (en `docs/technical/`)
- Procedimientos para: restaurar desde respaldo frío, rotar secretos, migrar de proveedor,
  re-sincronizar un agente atascado, responder a "detector caído". (Los redacta documentación.)

## A7. SLO informal (arranque)
- Disponibilidad best-effort en Fase A; objetivo alto con redundancia en Fase B.
- **Cero pérdida de datos** es el SLO duro (la redundancia de 3 capas existe para esto).

---

# Parte B — Gobernanza de datos

## B1. Propiedad
- Los datos de cada detector **pertenecen a su dueño/institución**. MunHub es custodio, no
  propietario. La institución decide visibilidad y uso.

## B2. Visibilidad y política de compartición
- Por **estación**: **pública / institución / privada** (D24, ver `11`).
- **Consentimiento de ML (opt-out):** entrenar es opt-in por defecto; interruptor en ajustes
  para excluir una estación del entrenamiento (default a nivel de usuario), con mensaje honesto
  que recomienda mantenerlo. El pipeline de IA respeta el opt-out. Ver `13`/`06`.
- **Embargo opcional:** una institución puede mantener datos privados por un período y
  liberarlos después (apoya la práctica científica de publicar primero).
- Compartir con usuarios/instituciones específicas (`detector_shares`).
- Datos públicos → visibles en landing/mapa y vía export; privados → solo dueño/compartidos/admin.

## B3. Atribución y licencia de datos
- Datos públicos bajo **CC-BY 4.0** (D19) → exige atribución. (El código es MIT.)
- La UI muestra a quién atribuir cada detector (institución + ubicación).
- Datos de **APIs externas** (NMDB/NOAA/DONKI) se citan según sus términos (ver `07`).

## B4. Términos de uso y privacidad
- **Términos** para instituciones/usuarios: qué se recopila, cómo se respalda, qué se hace
  público según su elección.
- **Datos personales mínimos:** solo lo necesario de la cuenta (email, nombre, institución,
  país, idioma). No recolectar de más. Permitir exportar/eliminar la cuenta.
- Los datos científicos del detector no son personales, pero la ubicación precisa puede ser
  sensible → permitir mostrar ubicación **aproximada** en público si la institución lo prefiere.

## B5. Retención y borrado
- Minutos: retención indefinida (valor científico). Realtime: ventana corta.
- Borrado de un detector/cuenta: con respaldo previo y, para datos públicos ya citados,
  política de tombstone (no romper referencias científicas).

## B6. Cumplimiento (pragmático)
- Sin pretensión legal pesada al inicio, pero alineado con principios GDPR-like (minimización,
  consentimiento, derecho a exportar/borrar) por ser red internacional. Revisar con la USFQ.

---

## Decisiones resueltas
- ✅ Licencia de datos públicos = **CC-BY 4.0** (D19).
- ✅ Mapa público = **agregación por ciudad** (D20); la ubicación exacta (lat/lon) se almacena
  pero NO se expone en el mapa público (solo ciudad). Sí disponible en datos compartidos/privados.

## Decisiones de producto pendientes (para el humano)
- ¿Permitir embargo temporal de datos? ¿Cuánto por defecto? (Ronda B)
