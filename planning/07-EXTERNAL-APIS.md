# MunHub Lab v6.0 — Integración de APIs externas

> Depende de: `00`–`02`. Cubre EPIC-7 (S26–S29). Todas las fuentes son **gratuitas y sin
> pago**. Objetivo: correlacionar nuestros datos de muones con clima espacial y eventos
> cósmicos/geomagnéticos para explicar variaciones del flujo.
>
> ⚠️ Los endpoints/formatos exactos deben **verificarse al implementar** (las APIs cambian).
> Este doc fija qué fuente, qué datos y para qué; el dev confirma URLs/parámetros vigentes.

---

## 1. Fuentes seleccionadas (D11)

| Fuente | Qué aporta | Por qué | Auth |
|--------|-----------|---------|------|
| **NMDB** (Neutron Monitor Database) | Conteos de monitores de neutrones en tiempo casi real; decrecimientos Forbush | **Lo más comparable** a muones: ambos siguen el flujo de rayos cósmicos | Sin clave (uso académico; citar) |
| **NOAA SWPC** | Viento solar, índice Kp, fulguraciones, alertas geomagnéticas | "Drivers" solares que explican variaciones del flujo | Sin clave (JSON abierto) |
| **NASA DONKI** | Catálogo de eventos: CME, fulguraciones, choques | Marcar eventos puntuales sobre las gráficas | API key gratuita (DEMO_KEY / propia) |
| **Índices Dst/Kp** (Kyoto WDC / GFZ Potsdam) | Índices geomagnéticos | Correlación con rigidez de corte ecuatorial (ventaja Ecuador) | Sin clave (citar) |

---

## 2. Qué se obtiene de cada una

- **NMDB:** series de conteo por estación (vía NEST / servicio de datos en tiempo real).
  Usar 1–2 estaciones de referencia + alguna de baja rigidez para contraste. Resolución
  horaria/minutal. Uso: detectar Forbush y comparar con nuestra tasa corregida.
- **NOAA SWPC:** productos JSON (p. ej. viento solar plasma/mag, Kp planetario, rayos X de
  fulguraciones GOES). Resolución sub-horaria. Uso: contexto solar y disparadores.
- **NASA DONKI:** consultas por rango de fechas de CME/flares/SEP. Uso: anotaciones de
  eventos en los charts ("CME el …").
- **Dst/Kp:** índice por hora/3h. Uso: nivel de actividad geomagnética para correlación.

---

## 3. Diseño de ingesta

```
[Scheduler] ─▶ [Fetcher por fuente] ─▶ [Normalizador] ─▶ external_events (cache local)
                     │ (respeta rate limits,                       │
                     │  reintentos, backoff)                       ▼
                     └──────────────────────────────▶ [UI: overlays/correlación]
```

- **Cache local obligatorio:** nunca consultar la API externa desde el navegador del usuario
  en cada vista. Un job programado trae los datos y los guarda en `external_events`; la UI
  lee de nuestra DB. (Protege rate limits, da offline y velocidad.)
- **Esquema `external_events`** (ver `02-DATA-MODEL`): `{id, source, kind, ts, payload jsonb,
  fetched_at}`. `payload` guarda el dato crudo normalizado.
- **Idempotencia:** clave `(source, kind, ts)` para no duplicar al re-traer.
- **Rate limits / cortesía:** intervalos de fetch razonables; backoff; User-Agent
  identificable; **citar/atribuir** cada fuente en la UI (requisito académico).
- **Tolerancia a fallos:** si una fuente cae, las demás siguen; se marca "stale" en UI.

---

## 4. Vistas de correlación (S29)

- Overlay de eventos externos (CME, Forbush, picos Kp) como marcadores/bandas sobre nuestras
  series temporales del detector.
- **Comparación muones ↔ neutrones (NMDB):** dos series alineadas; resaltar Forbush
  simultáneos (validación cruzada de nuestros datos).
- Análisis de **lag/correlación** con Kp/Dst/viento solar (apoya capacidad C6 de la IA).
- Todo el lenguaje científico revisado por el agente físico.

---

## 5. Contratos por fuente (a completar al implementar)

Para cada fuente, el dev backend documenta en su spec: URL base vigente, endpoints/parámetros,
formato de respuesta, resolución temporal, límites, términos de uso/atribución, y el mapeo
exacto a `external_events`. Mantener esa documentación junto al código del fetcher.

---

## 6. Fuera de alcance
- Fuentes de pago o con cuotas restrictivas.
- Re-distribuir datos crudos de terceros sin atribución/licencia adecuada.
