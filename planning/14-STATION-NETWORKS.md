# MunHub Lab v6.0 — Redes de Estaciones ("la manada")

> Decisión D27: agrupar estaciones en **redes/arrays** para análisis conjunto. Es lo
> científicamente más valioso de una red distribuida. Fase F4/F5. Depende de `02`, `07`, `06`.

---

## 1. Concepto

Una **Red** (network/array) es una agrupación lógica de estaciones para verlas y analizarlas
en conjunto. Ejemplos: "Andes Ecuador", "Campus USFQ", "Red EL-BONGO LatAm". Una estación
puede pertenecer a varias redes.

> No incluye (por D27): respaldo de datos entre estaciones (peer backup) — la redundancia de
> 3 capas ya protege los datos. La capacidad de varios detectores por estación existe en el
> modelo, pero la designación primario/backup no se construye ahora.

## 2. Quién las crea
- Un usuario/institución crea una red y añade estaciones (propias o públicas).
- Vinculación al **crear o editar** una estación, o desde un **panel de red** dedicado.
- Visibilidad de la red hereda las reglas de sus estaciones (solo se ven en conjunto las que
  el usuario puede ver).

## 3. Valor científico (lo que habilita)

- **Comparar y contrastar** varias estaciones en un mismo eje temporal (tasa corregida,
  presión, espectros).
- **Agregados regionales** (mapa/serie de la red completa).
- **Detección de eventos en red:** un Forbush **simultáneo en varias estaciones** = señal real
  de altísima confianza (vs. un artefacto local). Igual que NMDB confirma con múltiples monitores.
- **Estudios geográficos:** efecto de altitud/latitud entre estaciones de la red (aprovecha la
  ventaja ecuatorial: rigidez de corte única).
- **IA a nivel de red:** el pipeline (`06-AI-DESIGN`) puede correr análisis cruzado y reportar
  insights de red (correlación entre estaciones, propagación de un evento).

## 4. Modelo de datos (resumen; detalle en `02`)
- `networks(id, name, description, owner_uid, institution_id null, visibility, created_at)`
- `network_stations(network_id, station_id)`  — relación N:N
- `ai_insights` puede referenciar `network_id` (insights de red).

## 5. UI
- **Panel de red:** lista de estaciones, mapa de la red, charts comparativos, eventos
  detectados en común. Reutiliza componentes de `EPIC-5` (charts) y `S23` (mapa).
- Marcadores en el mapa del landing pueden agruparse por red además de por ciudad.

## 6. Backlog (nuevas specs → ver `04`)
- Crear/editar red y vincular estaciones.
- Vista comparativa multi-estación.
- Detección de eventos simultáneos en la red (con el agente físico validando el criterio).
