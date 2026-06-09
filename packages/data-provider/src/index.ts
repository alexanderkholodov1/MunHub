/**
 * @munhub/data-provider
 *
 * Provider-agnostic data access layer (keystone, D4). Exposes the {@link DataProvider} interface
 * and its supporting types. Implementations (FirebaseProvider in S08, SupabaseProvider in Phase B)
 * live behind this contract; nothing outside this package imports a backend SDK directly.
 */
export type { DataProvider } from "./provider.js";
export type {
  TimeRange,
  StationFilter,
  Unsubscribe,
  RealtimeCallback,
  ExportOptions,
  DataChunk,
  ImportReport,
} from "./types.js";
