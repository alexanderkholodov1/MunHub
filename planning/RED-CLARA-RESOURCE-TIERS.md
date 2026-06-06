# MunHub Lab v6.0 — Tiers de recursos a solicitar a Red Clara

> Depende de: `00`–`07`. Insumo para la **solicitud de infraestructura** a Red Clara.
> Alcance: el servidor aloja **web + DB + IA + respaldos** (decisión del humano).
> Filosofía de dimensionamiento: **procesamiento en el borde** (los PCs de los detectores
> hacen agregación/transformación) ⇒ el servidor carga menos de lo habitual. Margen
> **generoso** para experimentación científica adicional ("lo suficiente + un poco más").

---

## 1. Supuestos de carga

- **Hoy:** 1 detector (USFQ). **Interés:** ~8 universidades (sin confirmar). Diseñamos para
  escalar a **decenas** de detectores con estabilidad.
- **Volumen de datos (núcleo):** 1 registro/minuto por detector = 1.440/día.
  - 50 detectores ≈ 26 M filas/año; 200 detectores ≈ 105 M filas/año.
  - Con TimescaleDB (hypertables + compresión ~10×): **~1–8 GB/año** de serie temporal. Es
    pequeño. El almacenamiento lo dominan **respaldos, modelos de IA y datasets de
    experimentación**, no la serie en sí.
- **Carga de cómputo:** la web (Next.js SSR) y Postgres son modestos; el pico real son los
  **jobs de ML por lotes**. La ingesta pesada se hace en el borde (agente), no en el servidor.

---

## 2. Comparativa de tiers

| Recurso | 🟢 Conservador | 🔵 Recomendado | 🟣 Ambicioso |
|---|---|---|---|
| **Escenario** | MVP / pocas universidades | Red regional + margen | Red amplia + experimentación DL |
| **vCPU** | 4 | 8 | 16 |
| **RAM** | 8 GB | 32 GB | 64 GB |
| **Disco (NVMe/SSD)** | 100 GB | 500 GB | 1 TB |
| **GPU** | — | — | 1× GPU (p. ej. NVIDIA T4/A10/RTX, ≥16 GB VRAM) |
| **Detectores cómodos** | ~10–15 | ~50–80 (+margen) | 150+ |
| **Base de datos** | Postgres+TimescaleDB | + continuous aggregates | + **réplica** (alta disponibilidad) |
| **Respaldos fríos** | a Cloudflare R2 (externo) | R2 + snapshots del disco | R2 + snapshots + réplica |
| **IA** | ML clásico (CPU) | ML clásico holgado | ML clásico + **deep learning** (GPU) |
| **Red** | IP pública, ~50 Mbps | IP pública, ~100 Mbps | IP pública, ~200+ Mbps |
| **Uptime objetivo** | best-effort | alta | alta + redundancia |

> Todas las cifras de serie temporal caben de sobra incluso en el tier conservador; el salto
> entre tiers responde sobre todo a **margen de cómputo/IA, disponibilidad y experimentación**,
> no a falta de espacio para los datos de los detectores.

---

## 3. Qué habilita cada tier

- **🟢 Conservador** — Operar v6.0 con la red actual y unas pocas universidades. ML clásico
  básico (líneas base, corrección barométrica, anomalías). Respaldos a R2. Sin redundancia
  de DB. Suficiente para **arrancar y demostrar**.
- **🔵 Recomendado** *(elección base sugerida)* — Red regional (decenas de detectores) con
  holgura. ML clásico completo (forecasting, Forbush, correlaciones) corriendo cómodo.
  Continuous aggregates para charts rápidos de rangos largos. Margen para datasets y pruebas.
  **Equilibrio costo/capacidad para un despliegue serio.**
- **🟣 Ambicioso** — Red amplia + **experimentación científica adicional**: deep learning con
  GPU, réplica de DB para alta disponibilidad, más espacio para datasets/experimentos
  paralelos. Pedir este tier si Red Clara puede proveerlo, porque **da el "un poco más" para
  investigar sin pedir ampliaciones**.

---

## 4. Software / plataforma (igual en todos los tiers)

- SO: Linux LTS (Ubuntu Server LTS o equivalente).
- Contenedores: Docker + Docker Compose (todo en `infra/`).
- DB: PostgreSQL (16+) + extensión **TimescaleDB**.
- App: Node.js (Next.js) + servicios; Python para `services/ai`.
- Almacenamiento de objetos para respaldos: Cloudflare R2 (externo) o bucket S3-compatible.
- Acceso: IP pública + dominio + TLS (Let's Encrypt); puertos 80/443 (+ 22 SSH restringido).
- Snapshots del disco/VM si la plataforma los ofrece (refuerzo de la capa de respaldo).

---

## 5. Recomendación para la solicitud

Pedir el **🔵 Recomendado como línea base** y, si Red Clara tiene disponibilidad, **solicitar
el 🟣 Ambicioso** argumentando el valor científico del nodo ecuatorial (rigidez de corte
única, datos escasos en el hemisferio sur) y la necesidad de margen para **experimentos de
IA/DL** y crecimiento de la red multi-universidad. El 🟢 Conservador queda como mínimo
aceptable para no bloquear el arranque.

> **Acción pendiente del ing. ML:** afinar las cifras de cómputo/almacenamiento de IA cuando
> se concrete el volumen real de detectores y el alcance de los experimentos de DL.
