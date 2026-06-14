/**
 * The DataProvider interface — the keystone of the architecture (D4).
 *
 * The app, agent, api, and ai depend ONLY on this interface, never on a backend SDK. Phase A ships
 * a `FirebaseProvider` (S08); Phase B a `SupabaseProvider`. Switching backends = a new
 * implementation, not a change to callers. This same interface powers the admin migration tool
 * (S07): `exportAll` from one provider streamed into `importAll` of another.
 */
import type {
  User,
  Language,
  Institution,
  Station,
  Detector,
  Session,
  MinuteRecord,
  RealtimeRecord,
} from "@munhub/shared";
import type {
  TimeRange,
  StationFilter,
  Unsubscribe,
  RealtimeCallback,
  ExportOptions,
  DataChunk,
  ImportReport,
} from "./types.js";

export interface DataProvider {
  // ── Auth & tenancy ──────────────────────────────────────────────────────
  /** The currently authenticated user, or null if signed out. */
  getCurrentUser(): Promise<User | null>;
  /** Create an auth account and its `/users/{uid}` profile record. */
  register(
    email: string,
    password: string,
    profile: { displayName: string; language: Language },
  ): Promise<User>;
  /** Sign in with email/password and return the matching `/users/{uid}` record. */
  signIn(email: string, password: string): Promise<User>;
  /** Clear the current interactive auth session. */
  signOut(): Promise<void>;
  /** Send a password-reset email through the active auth backend. */
  sendPasswordReset(email: string): Promise<void>;
  /** Observe initial session restore plus login/logout changes. */
  onAuthStateChanged(cb: (user: User | null) => void): Unsubscribe;

  // ── Institutions ────────────────────────────────────────────────────────
  upsertInstitution(institution: Institution): Promise<void>;
  getInstitution(id: string): Promise<Institution | null>;

  // ── Stations (the profile/site) ───────────────────────────────────────────
  listStations(filter?: StationFilter): Promise<Station[]>;
  getStation(id: string): Promise<Station | null>;
  upsertStation(station: Station): Promise<void>;
  deleteStation(id: string): Promise<void>;

  // ── Detectors (the physical device, under a station) ──────────────────────
  listDetectors(stationId: string): Promise<Detector[]>;
  getDetector(id: string): Promise<Detector | null>;
  upsertDetector(detector: Detector): Promise<void>;

  // ── Sessions ──────────────────────────────────────────────────────────────
  listSessions(detectorId: string): Promise<Session[]>;
  upsertSession(session: Session): Promise<void>;

  // ── Time-series data (per detector) ────────────────────────────────────────
  /** Minute records within a time range (averages; corrections applied downstream). */
  getMinuteRecords(detectorId: string, range: TimeRange): Promise<MinuteRecord[]>;
  /** Append a minute record (idempotent on (detectorId, ts)). */
  pushMinuteRecord(detectorId: string, record: MinuteRecord): Promise<void>;
  /** The most recent minute record for a detector, or null if none. */
  getLatest(detectorId: string): Promise<MinuteRecord | null>;

  // ── Realtime (short-lived window) ──────────────────────────────────────────
  /** Subscribe to incoming realtime events; call the returned function to stop. */
  subscribeRealtime(detectorId: string, callback: RealtimeCallback): Unsubscribe;
  /** Append a realtime event (subject to the retention window / cap). */
  pushRealtimeRecord(detectorId: string, record: RealtimeRecord): Promise<void>;

  // ── Migration / portability (engine of the admin import/export, S07) ───────
  /** Stream the dataset out as chunks (Firebase→Supabase, v5→v6, backups). */
  exportAll(options?: ExportOptions): AsyncIterable<DataChunk>;
  /** Ingest a chunk stream; idempotent and resumable. Returns a summary report. */
  importAll(chunks: AsyncIterable<DataChunk>): Promise<ImportReport>;
}
