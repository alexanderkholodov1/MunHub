# Fundamento Teórico y Científico de MunHub Lab

> **Estado:** v1 — destilado del deep research (`planning/research/DEEP-RESEARCH-RESULTS.md`,
> temporal, descartable). Base científica OFICIAL del proyecto. Toda afirmación de física en
> UI, landing, IA y documentación debe ser consistente con este documento.
> **Revisión:** agente físico investigador. **Regla:** honestidad científica > marketing.

---

## 0. Síntesis ejecutiva (lo que NO se puede ignorar)

1. **Un solo SiPM no clasifica partículas.** Muón, electrón y gamma (vía Compton) producen
   pulsos indistinguibles (todos son MIP, ~2 MeV). Reportar "muón detectado" por evento es
   **especulación**. → Lo correcto: **"Tasa integral de partículas cargadas" / "tasa de
   eventos tipo-MIP"**.
2. **Los muones dominan estadísticamente** (~75–80% del flujo cargado a nivel del mar), así
   que la *curva agregada* sí está impulsada por muones — pero esa dominancia **disminuye en
   altitud** (Quito/Andes), donde el componente blando y hadrónico es 5–9× mayor.
3. **Correcciones obligatorias antes de hablar de "señal cósmica":** tiempo muerto +
   barométrica (coeficiente **local**, no universal) + térmica.
4. **El minuto es demasiado ruidoso** (Poisson: error ~1.6% por minuto). Las anomalías
   requieren integración de **muchas horas** (N≥100k) y umbrales **≥3σ persistentes**.
5. **Ventaja única de Ecuador:** rigidez de corte geomagnético **≈12–13 GV** (entre las más
   altas de la Tierra; el máximo global ≈17 GV está sobre el Sudeste Asiático) → filtra ruido
   solar de baja energía; los datos andinos son señal galáctica pura y escasa globalmente.

---

## 1. Rayos cósmicos primarios y cascadas atmosféricas

- **Primarios:** ~89% protones, ~9% partículas alfa, ~2% núcleos pesados/electrones (PDG).
  Origen solar (SEP, MeV–GeV), galáctico (GCR, supernovas, aceleración de Fermi) y
  extragaláctico/AGN (>10¹⁸ eV).
- **Espectro:** ley de potencias `dN/dE ∝ E⁻²·⁷` hasta el "codo" (~10¹⁵ eV). MunHub
  interactúa con secundarios de primarios de **10¹⁰–10¹² eV**.
- **Cascada (Extensive Air Shower):** un primario colisiona a 15–20 km y genera tres
  componentes:
  - **Hadrónico** (p, n, π, K) — núcleo, se atenúa rápido (Λ ≈ 110–148 g/cm²).
  - **Electromagnético** (e⁺e⁻, γ) — del decaimiento π⁰→γγ, modelo de Heitler.
  - **Muónico (penetrante)** — del decaimiento de π±/K± que no recolisionaron.
- **A nivel del mar** (X≈1033 g/cm²): el flujo cargado está **dominado por muones (75–80%)**.
  **En altitud andina** (Quito ~2850 m, ~730 hPa) la absorción es incompleta: flujo más
  denso y mixto (más electrones secundarios y gammas) → la dominancia muónica baja.

→ **Implicación MunHub:** el lenguaje debe distinguir "partícula cargada" de "muón"; el grado
de dominancia muónica depende del sitio (altitud) y debe declararse.

---

## 2. El muón atmosférico

- **Qué es:** leptón, carga ±1e, espín ½, masa **105.66 MeV/c²** (~207× el electrón). No
  siente la fuerza fuerte; solo EM y débil.
- **Producción:** `π⁺→μ⁺+ν_μ`, `π⁻→μ⁻+ν̄_μ` (branching ~99.9%).
- **Energía/flujo:** energía media en superficie **~4 GeV**; flujo integral vertical
  **~1 muón·cm⁻²·min⁻¹** (detector horizontal).
- **Dependencia angular:** `I(θ) ≈ I₀·cos²θ` (un muón inclinado atraviesa más atmósfera
  `X/cosθ` → más pérdida y más probabilidad de decaer).
- **Dilatación temporal (pilar educativo):** τ₀ = 2.197 µs ⇒ clásicamente solo ~660 m. Con
  γ≈38 (muón de 4 GeV), τ≈83.6 µs y alcance ~25 km → por eso llegan a superficie. **Prueba
  empírica directa de la Relatividad Especial.**

---

## 3. Física de detección (hardware CosmicWatch)

- **Hardware:** centellador plástico (poliestireno/PVT, ~5×5×1 cm³) + **SiPM** (Hamamatsu
  S13360 / SensL C-series). ADC 10-bit (v2) / 12-bit (v3X). (Axani et al. 2018; v3X 2025).
- **Pérdida de energía (Bethe-Bloch):** `−⟨dE/dx⟩` con mínimo en β·γ≈3–4 → **MIP**. Los
  muones cósmicos (>1 GeV) son MIP.
- **Depósito típico:** MIP ≈ 1.5–2.0 MeV·g⁻¹·cm² × ρ(~1 g/cm³) × 1 cm ⇒ **~2.0 MeV**.
- **Centelleo→señal:** ionización excita fluoróforos → fotones ~400 nm → reflexión interna →
  SiPM en modo Geiger (ganancia ~10⁶) → pulso.
- **Acondicionamiento:** peak-detector "estira" el pulso (ns→~100 µs) para que el ADC lo lea.
  Calibración (polinomio) ADC→mV. **Saturación ~180–200 mV** (depósitos muy grandes "ciegan"
  la amplitud → valor techo).

→ **Implicación MunHub:** `sm/sx/sn` (mV) reflejan energía depositada con techo de saturación;
documentarlo en tooltips. El espectro de amplitud es la observable física rica (§5).

---

## 4. Tiempo muerto y corrección de tasa (OBLIGATORIA)

- **Tiempo muerto por evento:** v2 ≈ **50 ms** (¡enorme!), v3X ≈ **400 µs** (Axani 2025,
  arXiv:2508.12111).
- La tasa medida **subestima** la real. Corrección no-paralizable:

  `R_real = R_medida / (1 − R_medida · τ_DT)`

- Ignorarla causa subestimaciones sistemáticas fatales (especialmente en sitios andinos de
  alta tasa) y arruina el cálculo barométrico.

→ **Implicación MunHub:** `packages/physics` DEBE aplicar esta corrección; τ_DT depende de la
versión de hardware (metadato del detector). El campo `dt` (% tiempo muerto) alimenta esto.

---

## 5. Limitación crítica del detector individual (honestidad científica)

- **Indistinguibilidad MIP:** un electrón de 15 MeV y un muón de 4 GeV depositan **los mismos
  ~2 MeV** al cruzar 1 cm → sus pulsos en mV se solapan. **Imposible separarlos con 1 SiPM.**
- **Contaminación gamma:** los γ ambientales (K-40, Th-232, radón) no ionizan directamente,
  pero por **dispersión Compton** producen electrones de retroceso que sí generan pulsos
  (engrosan canales bajos/medios).
- **Sin direccionalidad ni energía del primario** con un solo centellador.

**Qué SÍ es defendible reportar:**
- **Tasa integral de partículas cargadas** / **tasa de eventos tipo-MIP** (con umbral de
  amplitud declarado).
- Inferencia **agregada**: la dominancia muónica (75–80% a nivel del mar) implica que las
  *fluctuaciones* de la tasa rastrean a los muones galácticos (p. ej., un Forbush se ve).
- **Nunca** etiquetar un evento individual como "muón" con certeza.

→ **Implicación MunHub:** revisa S20 del backlog. El dashboard usa "partículas cargadas /
tipo-MIP" + incertidumbre; "muón" solo en contexto agregado o con coincidencia (§7).

---

## 6. Espectro de amplitud (energía depositada)

Histograma de amplitud agregado de un detector individual muestra 3 estructuras:
1. **Ruido térmico / sub-umbral** (dark count del SiPM, gammas blandos) — se filtra (p. ej.
   `ADC>30` o trigger dinámico).
2. **Distribución de Landau** — pico ancho asimétrico; el **MPV** (valor más probable)
   corresponde a los ~2 MeV del MIP.
3. **Cola de Landau (alta energía)** — trayectorias diagonales (mayor Δx), chubascos
   múltiples, rayos delta.

→ **Implicación MunHub:** el **espectro de amplitud/Landau es un chart de primera clase**
(EPIC-5 S18), con escala log y el MPV marcado. Es lo más cercano a "física de energía" honesta.

---

## 7. Coincidencia y telescopios de muones (evolución)

- Apilar 2+ detectores + (opcional) absorbente (Pb/acero); compuerta lógica **AND** en
  ventana temporal (ns por hardware; ~10 ms por software/timestamps).
- **Beneficios:** pureza de muones **>99%** (purga el componente blando), rechazo del ruido
  térmico (coincidencia fortuita v3X ~4.5×10⁻⁵ Hz), y **direccionalidad** (cono de
  aceptancia → anisotropía Este-Oeste).

→ **Implicación MunHub:** `detector_type=coincidence` habilita reportar "muones" con rigor y
direccionalidad. El esquema ya lo soporta (`02-DATA-MODEL`).

---

## 8. Modulaciones del flujo y correcciones

### (A) Barométrica — la dominante en superficie
`I(P) = I₀·e^(β(P−P₀))` ⇒ lineal: `−ln(I/I₀) = β(P−P₀)`. **β NO es universal:**

| Estación | β (%/hPa) | Referencia |
|---|---|---|
| Ecuatorial (Jeddah, superficie) | ≈ −0.24 ± 0.18 | Maghrabi et al. |
| Polo Sur (Marambio, WCD) | ≈ −0.20 ± 0.03 | LAGO / Santos (2021) |
| Global Muon Detector Network | ≈ −0.12 a −0.17 | De Mendonça et al. (2016) |
| Baja latitud/alta rigidez (Hong Kong) | ≈ −0.085 | Wang & Lee (1967) |

→ **Implicación MunHub:** `packages/physics` calcula **β local por regresión** sobre el
histórico de cada nodo; nunca asumir un β fijo. (Refuerza S04 y la capacidad C2 de IA.)

### (B) Térmica — dual
- **Negativa (superficie/altura):** aire caliente se expande → cascada se inicia más arriba →
  muones recorren más → más decaen → menos flujo.
- **Positiva (subterráneo profundo, p. ej. IceCube):** menor densidad → menos colisiones que
  abortan piones → más muones duros.
- Corrección fina requiere perfiles verticales (GFS/NCEP).

### (C) Diurna / estacional / solar
- Variación diurna (anisotropía del viento solar), estacional (temperatura), y **ciclo solar
  de 11 años** (anticorrelación: máximo solar → menos GCR).

### (D) Altitud
- Quito ~2850 m → ~730 hPa; flujo hadrónico/neutrónico **5–9× mayor** que a nivel del mar.
  Normalizar análisis multi-estación por la isobara nativa de referencia.

### (E) Rigidez de corte geomagnético — el contexto de Ecuador
- `R = pc/(ze)` [GV]. Solo partículas con `R > R_c` (rigidez de corte local) penetran.
- Polos: R_c ~1 GV (entran partículas débiles). **Andes ecuatoriales: R_c ≈ 12–13 GV**
  (entre las más altas de la Tierra; el máximo global ≈17 GV corresponde a Doi Inthanon,
  Tailandia — Gerontidou et al. 2021; PSNM) → filtro natural que purga el ruido solar de
  baja energía.

→ **Implicación MunHub:** principal argumento científico (y para la solicitud a Red Clara):
los datos ecuatoriales son señal galáctica dura, prístina y escasa en redes del hemisferio norte.

---

## 9. Clima espacial y eventos (correlación externa)

- **Decrecimientos de Forbush (FD):** una CME barre los GCR → caída súbita y asimétrica de la
  tasa (**1% a ~10%**, según latitud), inicio en horas, recuperación en **días–semanas**.
  Certificar cruzando con **NMDB** (neutrones), **NOAA SWPC** (B, Bz, viento solar) y
  **NASA DONKI** (catálogo CME/flares).
- **GLE (Ground Level Enhancements):** protones solares directos. **Prácticamente nulos en
  Ecuador** por la alta rigidez de corte (~12–13 GV; honestidad: no prometer detección de GLE en Andes).
- **Tormentas geomagnéticas:** índices **Kp** (3-horario, 0–9) y **Dst** (horario, nT) →
  features para la IA; pueden bajar transitoriamente R_c.
- **Ciclo solar 11 años:** anticorrelación de largo plazo.

→ **Implicación MunHub:** valida y prioriza EPIC-7 (NMDB/NOAA/DONKI/Kp-Dst) y las vistas de
correlación muones↔neutrones.

---

## 10. Estadística y "valores normales"

- **Poisson:** los eventos son independientes; para N cuentas, `σ ≈ √N`. Error relativo
  `√N/N`.
- **El minuto es ruidoso:** N≈3600/min → σ≈60 → error **~1.6%**. Un Forbush débil (~1%) queda
  enterrado en el ruido por minuto.
- **Buenas prácticas:** integrar **horas** (N≥100k) → error <0.3%. Definir anomalía con
  umbrales **≥3σ persistentes**, sobre tasa ya corregida (tiempo muerto + barométrica + térmica).
- **Línea base por detector:** construir el "normal" empíricamente con histórico en calma
  solar, tras quitar deltas térmico-barométricos. No usar fórmulas a priori.

→ **Implicación MunHub:** los charts/alertas usan ventanas móviles largas; la IA respeta estos
límites (nada de "anomalías" sobre un minuto). Refuerza C1/C3 de `06-AI-DESIGN`.

---

## 11. IA/ML defendible (resumen; detalle en `06-AI-DESIGN.md`)

- **Anomalías (no supervisado):** Autoencoders, Isolation Forest sobre el vector
  multivariado (mV, tasa corregida, presión, temperatura).
- **Corrección barométrica/térmica no lineal:** **Gradient Boosting (XGBoost/LightGBM)** en
  vez de un β lineal estático.
- **Forecasting:** ARIMA/SARIMA y LSTM (recuperación post-Forbush).
- **Correlación cruzada:** clustering/SVM (DBSCAN) contra DONKI/NMDB/Kp para datar el choque.

→ **Implicación MunHub:** actualizar `06-AI-DESIGN` con XGBoost como enfoque de corrección
(C2) y el límite Poisson como restricción dura de las ventanas.

---

## 12. Glosario divulgativo (para landing F3 y tooltips)

Versiones rigurosas pero accesibles disponibles en el deep research (sección "Glosario"):
**Rayo cósmico, Cascada atmosférica, Muón, Dilatación temporal, Centellador plástico, SiPM,
Corrección barométrica, Decrecimiento de Forbush, Rigidez de corte geomagnético.** El agente
de documentación las adapta a es/en/pt-BR para los textos educativos.

---

## 13. Referencias

- Particle Data Group, *Review of Particle Physics* (sección Cosmic Rays).
- Axani et al., *The CosmicWatch Desktop Muon Detector* (2018); v3X (2025, arXiv:2508.12111).
- Grieder, *Cosmic Rays at Earth*; Gaisser, *Cosmic Rays and Particle Physics*.
- Heitler, *The Quantum Theory of Radiation* (modelo de cascada EM).
- LAGO Collaboration; Santos (2021) — coeficiente barométrico, WCD.
- De Mendonça et al. (2016) — Global Muon Detector Network.
- Maghrabi et al. (KAAU) — estación ecuatorial; Wang & Lee (1967) — Hong Kong.
- IGRF (International Geomagnetic Reference Field) — rigidez de corte.
- Gerontidou et al. (2021), "World grid of cosmic ray vertical cut-off rigidity for the last
  decade," *Adv. Space Res.* 67, 2231–2240. https://doi.org/10.1016/j.asr.2021.01.011
- Banglieng et al. / PSNM Collaboration — Princess Sirindhorn Neutron Monitor at Doi Inthanon,
  Thailand (R_c ≈ 17 GV, highest known station); arXiv:2605.15696 and refs therein.
- Maghrabi et al. (2023), "The Role of Atmospheric Pressure, Temperature, and Humidity on
  Cosmic Ray Muons at a Low Latitude Station (KAAU, Jeddah; β ≈ −0.24 ± 0.18 %/hPa),"
  *Int. J. Astron. Astrophys.* 13, 236–258. https://doi.org/10.4236/ijaa.2023.133013
- NMDB (Neutron Monitor Database); NOAA SWPC; NASA DONKI.

> Verificar y completar citas (DOI/enlaces) al preparar el artículo científico (EPIC-12 S48).
