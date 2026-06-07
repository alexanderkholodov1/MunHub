/**
 * @munhub/physics
 *
 * Pure scientific calculations for cosmic ray / MIP-type particle data.
 * NO I/O dependencies — every function is a pure transformation testable in isolation.
 *
 * Implementations land in S06 (dead-time correction, barometric correction, flux,
 * Landau spectrum). This stub validates the build pipeline only.
 *
 * Key formulas (see docs/research/THEORETICAL-FOUNDATION.md):
 *   Dead-time correction : R_real = R_measured / (1 - R_measured × τ_DT)
 *   Barometric correction: I(P) = I₀ · e^(β · (P − P₀))  [β = local, by regression]
 */

export const PHYSICS_STUB = "physics-package-stub-v6" as const;
