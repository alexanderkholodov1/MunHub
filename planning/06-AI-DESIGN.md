# MunHub Lab v6.0 — Diseño de la IA propia (planificación)

> Depende de: `00`–`02` + reporte teórico de física. Cubre EPIC-10 (S39–S41).
> **Solo diseño ahora.** Implementación en F7, cuando Red Clara provea servidor.
> Decisión D12: **ML clásico primero, diseñado para escalar a deep learning.**
> El agente físico tiene veto sobre cualguier afirmación científica generada por la IA.

---

## 1. Objetivo y filosofía

Una IA **simple pero funcional y útil**, entrenada en nuestros datos, que: muestre
estadísticas e insights, intente explicar eventos, prediga, se reentrene de forma autónoma
(self-improve), se auto-repare (self-heal), y ayude a entender qué significan los valores y
cuáles son "normales". **Sin APIs de pago**: modelo propio en el servidor.

Principio rector: **utilidad honesta**. Con detectores de 1 SiPM y volúmenes modestos, los
modelos clásicos bien hechos dan más valor (y más interpretables) que DL prematuro. Diseñamos
la tubería para poder añadir DL después sin rehacerla.

---

## 2. Datos disponibles (realidad del hardware)

De `minute_records`: `ec, cc, sm, sx, sn, tp, pr, dt` + derivados (`ec_dt`, `ec_corr`, `flux`).
De `external_events`: NMDB, NOAA SWPC, DONKI, Dst/Kp. Metadatos del detector (lat/lon/altitud,
emplazamiento). **Limitación:** 1 SiPM no separa tipos de partícula → la IA NO clasifica
partículas en fase 1; trabaja sobre tasa, espectro de amplitud y correlaciones.

> **Restricción dura (Poisson, `THEORETICAL-FOUNDATION.md` §10):** el minuto es demasiado
> ruidoso (error ~1.6%). Toda detección de anomalías/Forbush opera sobre **ventanas de horas**
> (N≥100k cuentas, error <0.3%) y umbrales **≥3σ persistentes**, sobre tasa ya corregida
> (tiempo muerto → barométrica → térmica). Nada de "anomalías" sobre un solo minuto.

---

## 3. Capacidades (modelos), de simple a avanzado

| # | Capacidad | Enfoque (fase 1, clásico) | Valor |
|---|-----------|---------------------------|-------|
| C1 | **Línea base / "valores normales"** | Estadística robusta por detector (medianas, IQR, perfiles diurno/estacional); naturaleza poissoniana (√N) | Define qué es normal por sitio |
| C2 | **Corrección barométrica/térmica** | **Gradient Boosting (XGBoost/LightGBM)** no lineal con β **local**, superando al ajuste lineal estático; primero corregir tiempo muerto | Quita efecto atmosférico (clave) |
| C3 | **Detección de anomalías** | Autoencoder / Isolation Forest sobre el vector (mV, tasa corregida, P, T); z-score robusto / STL | Alerta de eventos raros |
| C4 | **Detección de Forbush** | Patrón de caída rápida + recuperación lenta en tasa corregida; corroborar con NMDB | Evento científico estrella |
| C5 | **Forecasting de tasa** | ARIMA/SARIMA, Prophet, o pequeño modelo; banda de confianza | Predicción + detección de desvíos |
| C6 | **Correlación con clima espacial** | Correlación/lag con Kp/Dst/viento solar/NMDB | Explicar eventos terrestres↔cósmicos |
| C7 | **Insights/explicaciones** | Plantillas data-driven ("tasa 12% bajo lo normal, coincide con Forbush del NMDB el …") | Lenguaje claro para usuarios |
| (futuro) | Clasificación, DL | LSTM/Transformers temporales, autoencoders | Si hay GPU + datos |

---

## 4. Arquitectura del pipeline (`services/ai`, Python)

```
   minute_records ─┐
   external_events ─┼─▶ [Feature builder] ─▶ [Feature store / tablas] 
   metadata ───────┘                              │
                                                  ▼
                            ┌───────── [Entrenamiento por detector] (batch programado)
                            │                     │ (modelos versionados + métricas)
                            ▼                     ▼
                     [Model registry]   ◀── [Evaluación / validación]
                            │
                            ▼
   [Servicio de inferencia] ─▶ ai_insights (jsonb) ─▶ API ─▶ UI (insights/forecast/alertas)
```

- **Batch primero** (jobs programados); inferencia online opcional luego.
- **Por detector** (cada sitio tiene su normalidad), con posibilidad de modelos globales.
- **Versionado:** cada modelo guarda `model_version`, datos/rango de entrenamiento, métricas.
- **Contrato de salida `ai_insights`** (S41): `{detector_id, kind, ts_range, result(jsonb),
  model_version, confidence}`.

---

## 5. Self-improve y self-heal

- **Self-improve (reentrenamiento autónomo):** schedule de reentrenamiento; si el nuevo
  modelo supera al actual en validación (métricas pre-definidas), se promueve; si no, se
  descarta. Champion/challenger.
- **Self-heal:** monitoreo de: deriva de datos (data drift), caída de métricas, errores de
  job. Acciones automáticas: reintento, rollback al último modelo bueno, alerta al admin,
  reconstrucción de features. Todo registrado/auditable.
- **Guardas:** un modelo nunca emite afirmaciones científicas fuera de plantillas aprobadas
  por el físico; incertidumbre siempre declarada.

---

## 6. Stack tecnológico

- **Fase 1 (CPU):** Python, numpy/pandas, scikit-learn, statsmodels, Prophet; orquestación
  con jobs (cron/worker); almacenamiento de modelos en filesystem/objeto.
- **Diseñado para escalar:** interfaces que permitan sustituir/añadir PyTorch (DL) y GPU sin
  rehacer el pipeline (mismo feature store, mismo registry, mismo contrato `ai_insights`).
- **Servidor:** corre en Red Clara (ver tiers). Sin GPU en fase 1; GPU opcional para DL.

---

## 7. Necesidades de recursos (insumo para tiers Red Clara)

| Recurso | Fase 1 (clásico) | Fase 2 (DL) |
|---------|------------------|-------------|
| CPU | medio (jobs batch) | alto |
| RAM | 8–16 GB | 32+ GB |
| GPU | no | sí (1 GPU media) |
| Almacenamiento | datos + modelos + features (crece con la red) | + datasets DL |

> Estas cifras alimentan `RED-CLARA-RESOURCE-TIERS.md`. El ing. ML debe afinarlas con
> estimaciones de volumen (nº detectores × registros/día × retención).

---

## 8. Fuera de alcance (fase 1)
- Clasificación de tipo de partícula con 1 SiPM.
- LLMs/IA generativa de pago.
- Cualquier afirmación científica no respaldada por el reporte teórico.
