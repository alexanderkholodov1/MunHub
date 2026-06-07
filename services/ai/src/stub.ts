/**
 * services/ai — MunHub AI/ML service stub (Phase B / F7+).
 *
 * ML pipeline (Python + TypeScript glue) for:
 *   - Barometric β regression per station (XGBoost/LightGBM)
 *   - Forbush decrease detection (anomaly detection, ≥3σ, hourly windows)
 *   - Self-healing champion-challenger retraining
 *
 * See planning/06-AI-DESIGN.md and docs/research/THEORETICAL-FOUNDATION.md §10
 * for Poisson noise constraints (N≥100k for ≥3σ detection).
 */

export const AI_STUB = "ai-service-stub-v6" as const;
