/**
 * Particle flux from a counting rate and the detector's effective area.
 *
 * flux = rate / area, in particles/cm²/min — the `flux` derived field of `MinuteRecord`.
 * Defined only when an effective area is configured for the detector.
 */
export function rateToFlux(ratePerMin: number, effectiveAreaCm2: number): number {
  if (!Number.isFinite(ratePerMin) || ratePerMin < 0) {
    throw new RangeError(`ratePerMin must be finite and ≥ 0, got ${ratePerMin}`);
  }
  if (!Number.isFinite(effectiveAreaCm2) || effectiveAreaCm2 <= 0) {
    throw new RangeError(`effectiveAreaCm2 must be finite and > 0, got ${effectiveAreaCm2}`);
  }
  return ratePerMin / effectiveAreaCm2;
}
