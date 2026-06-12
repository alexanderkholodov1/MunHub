- Domain contracts in `@munhub/shared` (spec S03): Zod schemas with inferred TypeScript types for
  `Institution`, `User`, `Station`, `Detector`, `Session`, `MinuteRecord`, and `RealtimeRecord`,
  plus shared enums and constants. Schemas are the single source of truth (runtime validation and
  types stay in lock-step) and enforce the data invariants (averages-not-sums, `sn ≤ sm ≤ sx`,
  dead-time `0..100`, explicit station visibility).
