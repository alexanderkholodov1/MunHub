const DEFAULT_CLOCK_SKEW_WARNING_THRESHOLD_MS = 180_000;

export interface TimeSource {
  machineTimeMs(): number;
  trueTimeMs(): number | Promise<number>;
}

export interface ClockOffsetOptions {
  readonly skewWarningThresholdMs?: number;
}

export interface ClockOffsetMeasurement {
  /** trueTime - machineTime, using the local midpoint around the time-source read. */
  readonly offsetMs: number;
  readonly clockSkewWarning: boolean;
  readonly skewWarningThresholdMs: number;
}

/**
 * Measure machine-clock skew against an injectable true-time source.
 *
 * The source can be a real NTP adapter or a mock. The logic uses the midpoint between the local
 * timestamps before and after the true-time read, keeping network/hardware I/O outside this module.
 */
export async function measureClockOffset(
  timeSource: TimeSource,
  options: ClockOffsetOptions = {},
): Promise<ClockOffsetMeasurement> {
  const threshold = options.skewWarningThresholdMs ?? DEFAULT_CLOCK_SKEW_WARNING_THRESHOLD_MS;
  if (!(threshold >= 0)) {
    throw new RangeError(`skewWarningThresholdMs must be non-negative, got ${threshold}`);
  }

  const machineBeforeMs = timeSource.machineTimeMs();
  const trueTimeMs = await timeSource.trueTimeMs();
  const machineAfterMs = timeSource.machineTimeMs();
  const machineMidpointMs = (machineBeforeMs + machineAfterMs) / 2;
  const offsetMs = trueTimeMs - machineMidpointMs;

  return {
    offsetMs,
    clockSkewWarning: Math.abs(offsetMs) > threshold,
    skewWarningThresholdMs: threshold,
  };
}
