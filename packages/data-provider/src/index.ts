/**
 * @munhub/data-provider
 *
 * Provider-agnostic data access layer (keystone architecture principle).
 *
 * The DataProvider interface is the ONLY way the app interacts with any backend.
 * Firebase (Phase A) and Supabase (Phase B) are hidden behind it.
 * This is also the engine for admin cross-provider migration (export → import).
 *
 * Implementations land in S04 (interface), S08 (FirebaseProvider),
 * and S07 (migration tool). This stub validates the build pipeline only.
 *
 * RULE: nothing outside this package may import Firebase or Supabase SDKs directly.
 */

export const DATA_PROVIDER_STUB = "data-provider-stub-v6" as const;
