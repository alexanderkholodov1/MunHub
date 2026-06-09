- The provider-agnostic `DataProvider` interface and its supporting types (`TimeRange`,
  `StationFilter`, `DataChunk`, `ImportReport`, …) in `@munhub/data-provider` (spec S04) — the
  keystone that lets the app run on Firebase or Supabase without changes, and the engine of the
  admin export/import migration. Typed entirely against `@munhub/shared`; no backend SDK.
