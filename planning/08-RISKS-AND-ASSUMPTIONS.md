# MunHub Lab v6.0 — Riesgos y Supuestos

> Depende de: `00`–`07`. Registro vivo. Cada agente que detecte un riesgo nuevo lo añade.
> Severidad = Impacto × Probabilidad. Cada riesgo tiene **mitigación** y **dueño**.

---

## 1. Riesgos técnicos

| # | Riesgo | Sev. | Mitigación | Dueño |
|---|--------|------|-----------|-------|
| R1 | **Datos de `munra-1` inaccesibles para migrar.** El proyecto v5 está "saturado/bloqueado"; si el bloqueo limita lecturas, no podremos exportar el histórico. | 🔴 Alta | **Validar lectura YA** (antes de F1): probar export con el service account. Plan B: exportar vía Firebase Console (backup/Export JSON) o `firebase database:get`; si hay bloqueo de billing, habilitar temporalmente Blaze solo para extraer. Guardar un **dump frío** del v5 cuanto antes. | Ing. DB |
| R2 | **Pérdida de datos del único detector real** durante la transición v5→v6. | 🔴 Alta | No apagar el flujo v5 hasta que el MVP v6 grabe en paralelo y se valide; doble escritura temporal si hace falta. | Ing. DB |
| R3 | **Reloj de la flota desincronizado.** Timestamps del agente dependen del reloj del PC; deriva afecta gaps, orden y futura coincidencia. | 🟠 Media | El agente sincroniza por **NTP** y registra offset; timestamps en UTC; documentar timezone del detector (ya en metadatos). Coincidencia por software asume ventana ~10 ms (ver foundation §7). | Dev Agente |
| R4 | **Límite/costo de Firebase munhub-1** (plan gratuito ~1GB) se vuelve a saturar antes de migrar a Red Clara. | 🟠 Media | Esquema eficiente + retención de realtime + respaldos fríos a R2 + monitoreo de uso; la corrección/derivados se calculan en el borde (no inflar la DB). Si crece, pasar a Blaze controlado. | Ing. DB |
| R5 | **Web Serial / drivers** fallan en algún SO/navegador. | 🟡 Baja | El **agente Tauri** es el camino primario (no depende del navegador); Web Serial es solo atajo en Chromium. | Dev Agente |
| R6 | **Acoplamiento accidental al SDK** (saltarse el DataProvider) rompe la portabilidad Firebase↔Supabase. | 🟠 Media | Lint/review que prohíbe imports directos del SDK fuera de `data-provider`; el arquitecto lo vigila en PR. | Arquitecto |
| R7 | **Migración Firebase→Supabase con pérdidas** (tipos/precisión). | 🟠 Media | Adaptadores con validación `zod`, reporte de cuarentena, pruebas de round-trip export/import antes del switch. | Ing. DB |

## 2. Riesgos científicos

| # | Riesgo | Sev. | Mitigación |
|---|--------|------|-----------|
| R8 | **Sobrepromesa científica** (etiquetar "muones" con 1 SiPM, anomalías sobre 1 minuto). | 🔴 Alta | Veto del agente físico; nomenclatura "partículas cargadas/tipo-MIP"; ventanas de horas + 3σ (foundation §5, §10). |
| R9 | **β barométrico mal aplicado** (usar uno universal). | 🟠 Media | β **local por regresión** por nodo; tests contra rangos del foundation §8. |
| R10 | **Ignorar corrección de tiempo muerto** → subestimación sistemática. | 🟠 Media | `packages/physics` aplica `R/(1−R·τ_DT)` obligatorio; τ_DT por versión de hardware. |

## 3. Riesgos de proyecto / organización

| # | Riesgo | Sev. | Mitigación |
|---|--------|------|-----------|
| R11 | **Adopción incierta** (8 universidades interesadas, sin confirmar). | 🟡 Baja | Diseñar para escalar pero desplegar modesto (tier conservador/recomendado); no sobre-invertir en infra antes de tracción. |
| R12 | **Deriva de los agentes** (construir fuera de spec). | 🟠 Media | SDD con gates humanos; AGENTS.md; orquestador; "no código sin spec". |
| R13 | **Dependencia de un solo mantenedor** (Alexander). | 🟠 Media | Documentación exhaustiva (EPIC-12) + monorepo + specs para onboarding de externos. |
| R14 | **Red Clara tarda o no provee** los recursos. | 🟠 Media | La Fase A (Firebase) es autosuficiente; la capa agnóstica permite operar indefinidamente en nube si hace falta. |

---

## 4. Supuestos (a confirmar)

- **A1:** El service account de `munra-1` permite leer el histórico (⚠️ ver R1 — confirmar pronto).
- **A2:** El detector USFQ emite uno de los 4 formatos serial ya soportados en v5.
- **A3:** `munhub-1` arranca en plan gratuito; se pasará a Blaze si el volumen lo exige.
- **A4:** τ_DT del hardware actual ≈ 50 ms (CosmicWatch v2) — confirmar la versión real.
- **A5:** Hay un detector público disponible para la demo en vivo del landing (F3).
- **A6:** Red Clara entregará un servidor Linux con Docker (tiers en `RED-CLARA-RESOURCE-TIERS.md`).

> **Acción inmediata recomendada (antes de F1):** validar A1/R1 — confirmar que se puede
> extraer el histórico de `munra-1` y guardar un dump frío. Es el riesgo de mayor impacto.
