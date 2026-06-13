- `@munhub/physics` scientific core (spec 0005): non-paralyzable dead-time correction (per-hardware
  τ_DT and recorded `dt` percent), station-local barometric β by log-linear regression with applied
  correction, Poisson counting statistics with robust median/IQR baselines, amplitude histogram
  with Landau MPV estimation, and rate→flux — all pure functions with numeric tests against the
  theoretical-foundation reference values and a ≥80% coverage hard-gate.
