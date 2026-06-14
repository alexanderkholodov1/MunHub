/**
 * FirebaseProvider — the Phase A concrete DataProvider over munhub-1 Firebase Realtime Database.
 *
 * Supports two SDK targets (FR1):
 *   - "client": uses `firebase/database` + `firebase/auth` (browser / web app).
 *   - "admin":  uses `firebase-admin` (Tauri agent / migration tooling / server).
 *
 * Both share all serialization / validation logic; only the RTDB ref + auth handles differ.
 *
 * SDK boundary: this is the ONLY place in the monorepo that imports firebase/firebase-admin.
 * No firebase type leaks across the public package boundary — the public surface is
 * exactly `DataProvider` + `FirebaseProviderConfig`.
 *
 * Spec: specs/0007-firebase-provider/spec.md
 */

import type {
  User,
  Institution,
  Station,
  Detector,
  Session,
  MinuteRecord,
  RealtimeRecord,
} from "@munhub/shared";
import {
  InstitutionSchema,
  StationSchema,
  DetectorSchema,
  SessionSchema,
  MinuteRecordSchema,
  RealtimeRecordSchema,
} from "@munhub/shared";
import type { DataProvider } from "./provider.js";
import type {
  TimeRange,
  StationFilter,
  Unsubscribe,
  RealtimeCallback,
  ExportOptions,
  DataChunk,
  ImportReport,
} from "./types.js";
import { Paths, padTs } from "./firebase-paths.js";
import {
  serializeInstitution,
  deserializeInstitution,
  serializeStation,
  deserializeStation,
  serializeDetector,
  deserializeDetector,
  serializeSession,
  deserializeSession,
  serializeMinuteRecord,
  deserializeMinuteRecord,
  serializeRealtimeRecord,
  deserializeRealtimeRecord,
  warn,
} from "./firebase-serializer.js";
import { deserializeUser } from "./firebase-serializer.js";
// Type-only imports — erased at compile time, so they never pull the admin SDK
// into the client bundle. Runtime values come from dynamic import() below.
import type { App, ServiceAccount } from "firebase-admin/app";
import type { Reference, DataSnapshot, Query } from "firebase-admin/database";

// ── RTDB page size for exportAll (avoids loading entire dataset in memory) ────
const EXPORT_PAGE_SIZE = 500;

// ── Realtime window (cap old records on push, per spec §4) ────────────────────
const REALTIME_CAP = 5000;

// ── Config ────────────────────────────────────────────────────────────────────

export interface FirebaseClientConfig {
  target: "client";
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface FirebaseAdminConfig {
  target: "admin";
  databaseURL: string;
  /** Service-account JSON as a string (from env — never the private/ file). */
  serviceAccount?: string;
  /**
   * Optional uid for getCurrentUser on admin target (no session by default).
   * The asymmetry is documented: admin has no session; supply uid via config for tooling use.
   */
  uid?: string;
}

export type FirebaseProviderConfig = FirebaseClientConfig | FirebaseAdminConfig;

// ── Internal ref abstraction ──────────────────────────────────────────────────

/**
 * Minimal RTDB ref interface that both client and admin targets satisfy.
 * We keep this internal so no Firebase type crosses the package boundary.
 */
interface RtdbRef {
  get(): Promise<RtdbSnapshot>;
  set(value: unknown): Promise<void>;
  update(value: Record<string, unknown>): Promise<void>;
  transaction(
    update: (current: unknown) => unknown,
  ): Promise<{ committed: boolean; snapshot: RtdbSnapshot }>;
  orderByKey(): RtdbQuery;
  orderByChild(child: string): RtdbQuery;
  equalTo(value: unknown): RtdbQuery;
  /** Appends a child with a server timestamp key. */
  push(value: unknown): Promise<void>;
  on(
    event: "child_added" | "value",
    callback: (snap: RtdbSnapshot) => void,
    errorCallback?: (err: Error) => void,
  ): () => void;
  off(event?: string, callback?: (snap: RtdbSnapshot) => void): void;
  limitToLast(n: number): RtdbQuery;
  child(path: string): RtdbRef;
}

interface RtdbQuery extends RtdbRef {
  startAt(value: unknown): RtdbQuery;
  endAt(value: unknown): RtdbQuery;
}

interface RtdbSnapshot {
  val(): unknown;
  key: string | null;
  exists(): boolean;
  forEach(cb: (child: RtdbSnapshot) => boolean | void): void;
}

/** Auth interface for the client target only. */
interface RtdbAuth {
  currentUser: { uid: string } | null;
}

// ── Adapter interfaces (one per SDK target) ───────────────────────────────────

interface RtdbAdapter {
  ref(path: string): RtdbRef;
}

// ── Client SDK adapter ────────────────────────────────────────────────────────

async function buildClientAdapter(
  config: FirebaseClientConfig,
): Promise<{ adapter: RtdbAdapter; auth: RtdbAuth }> {
  // Dynamic import so the admin bundle never pulls in the client SDK.
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getDatabase, ref, get, set, update, push, onChildAdded, onValue, off, query,
    orderByKey, orderByChild, equalTo, startAt, endAt, limitToLast,
    runTransaction } = await import("firebase/database");
  const { getAuth } = await import("firebase/auth");

  // Build the options object omitting undefined optional keys — required under
  // exactOptionalPropertyTypes, where `storageBucket: undefined` is not a string.
  const appConfig: Record<string, string> = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    databaseURL: config.databaseURL,
    projectId: config.projectId,
  };
  if (config.storageBucket) appConfig.storageBucket = config.storageBucket;
  if (config.messagingSenderId) appConfig.messagingSenderId = config.messagingSenderId;
  if (config.appId) appConfig.appId = config.appId;

  const app =
    getApps().length === 0
      ? initializeApp(appConfig, "munhub-client")
      : getApp("munhub-client");

  const db = getDatabase(app);
  const firebaseAuth = getAuth(app);

  function wrapRef(rawRef: ReturnType<typeof ref>): RtdbRef {
    // Build a wrapped ref that matches our internal interface.
    const wrapped: RtdbRef = {
      async get() {
        const snap = await get(rawRef);
        return wrapSnap(snap);
      },
      async set(value) {
        await set(rawRef, value);
      },
      async update(value) {
        await update(rawRef, value);
      },
      async transaction(updateFn) {
        const result = await runTransaction(rawRef, updateFn);
        return { committed: result.committed, snapshot: wrapSnap(result.snapshot) };
      },
      orderByKey() {
        return wrapQuery(query(rawRef, orderByKey()));
      },
      orderByChild(child) {
        return wrapQuery(query(rawRef, orderByChild(child)));
      },
      equalTo(value) {
        return wrapQuery(query(rawRef, equalTo(value as string | number | boolean | null)));
      },
      limitToLast(n) {
        return wrapQuery(query(rawRef, limitToLast(n)));
      },
      child(path) {
        // For client SDK, build child ref
        const { ref: refFn } = { ref } as { ref: typeof ref };
        // We need the database ref for a child path — use the db
        return wrapRef(refFn(db, `${(rawRef as { toString(): string }).toString().replace(/.*?\/[^/]+\.[^/]+\//, "/")}/${path}`));
      },
      on(event, callback) {
        if (event === "child_added") {
          const unsub = onChildAdded(rawRef, (snap) => callback(wrapSnap(snap)));
          return () => unsub();
        }
        // value listener
        const unsub = onValue(rawRef, (snap) => callback(wrapSnap(snap)));
        return () => unsub();
      },
      off() {
        off(rawRef);
      },
      async push(value) {
        await push(rawRef, value);
      },
    };
    return wrapped;
  }

  function wrapQuery(q: ReturnType<typeof query>): RtdbQuery {
    const baseRef = wrapRef(q as unknown as ReturnType<typeof ref>);
    const wrapped: RtdbQuery = {
      ...baseRef,
      startAt(value) {
        return wrapQuery(query(q, startAt(value as string | number | boolean | null)));
      },
      endAt(value) {
        return wrapQuery(query(q, endAt(value as string | number | boolean | null)));
      },
      orderByKey() {
        return wrapQuery(query(q, orderByKey()));
      },
      orderByChild(child) {
        return wrapQuery(query(q, orderByChild(child)));
      },
      equalTo(value) {
        return wrapQuery(query(q, equalTo(value as string | number | boolean | null)));
      },
      limitToLast(n) {
        return wrapQuery(query(q, limitToLast(n)));
      },
    };
    return wrapped;
  }

  function wrapSnap(snap: { val(): unknown; key: string | null; exists(): boolean; forEach(cb: (child: Parameters<typeof wrapSnap>[0]) => boolean | void): void }): RtdbSnapshot {
    return {
      val: () => snap.val(),
      key: snap.key,
      exists: () => snap.exists(),
      forEach: (cb) => snap.forEach((child) => cb(wrapSnap(child))),
    };
  }

  const adapter: RtdbAdapter = {
    ref(path: string) {
      return wrapRef(ref(db, path));
    },
  };

  const auth: RtdbAuth = {
    get currentUser() {
      return firebaseAuth.currentUser;
    },
  };

  return { adapter, auth };
}

// ── Admin SDK adapter ─────────────────────────────────────────────────────────

async function buildAdminAdapter(
  config: FirebaseAdminConfig,
): Promise<{ adapter: RtdbAdapter }> {
  // Modular firebase-admin entry points (v12+). Dynamic import so the client
  // bundle never pulls in the admin SDK. Types come from the top-level
  // `import type` (erased at compile time — no runtime SDK pull).
  const { getApps, initializeApp, cert, applicationDefault } =
    await import("firebase-admin/app");
  const { getDatabase } = await import("firebase-admin/database");

  const existing = getApps().find((a: App) => a.name === "munhub-admin");
  const app: App =
    existing ??
    initializeApp(
      {
        credential: config.serviceAccount
          ? cert(JSON.parse(config.serviceAccount) as ServiceAccount)
          : applicationDefault(),
        databaseURL: config.databaseURL,
      },
      "munhub-admin",
    );

  const db = getDatabase(app);

  function wrapAdminRef(rawRef: Reference): RtdbRef {
    const wrapped: RtdbRef = {
      async get() {
        const snap = await rawRef.once("value");
        return wrapAdminSnap(snap);
      },
      async set(value) {
        await rawRef.set(value);
      },
      async update(value) {
        await rawRef.update(value);
      },
      async transaction(updateFn) {
        const result = await rawRef.transaction(updateFn);
        return {
          committed: result.committed,
          snapshot: wrapAdminSnap(result.snapshot as DataSnapshot),
        };
      },
      orderByKey() {
        return wrapAdminQuery(rawRef.orderByKey());
      },
      orderByChild(child) {
        return wrapAdminQuery(rawRef.orderByChild(child));
      },
      equalTo(value) {
        return wrapAdminQuery(rawRef.equalTo(value as string | number | boolean | null));
      },
      limitToLast(n) {
        return wrapAdminQuery(rawRef.limitToLast(n));
      },
      child(path) {
        return wrapAdminRef(rawRef.child(path));
      },
      on(event, callback, errorCallback) {
        const handler = (snap: DataSnapshot) =>
          callback(wrapAdminSnap(snap));
        rawRef.on(event as "child_added" | "value", handler, errorCallback);
        return () => rawRef.off(event as "child_added" | "value", handler);
      },
      off(event, _callback) {
        rawRef.off(event as "child_added" | "value" | undefined);
      },
      async push(value) {
        await rawRef.push(value);
      },
    };
    return wrapped;
  }

  function wrapAdminQuery(q: Query): RtdbQuery {
    const baseRef = wrapAdminRef(q.ref);
    const wrapped: RtdbQuery = {
      ...baseRef,
      async get() {
        const snap = await q.once("value");
        return wrapAdminSnap(snap);
      },
      startAt(value) {
        return wrapAdminQuery(q.startAt(value as string | number | boolean | null));
      },
      endAt(value) {
        return wrapAdminQuery(q.endAt(value as string | number | boolean | null));
      },
      orderByKey() {
        return wrapAdminQuery(q.orderByKey());
      },
      orderByChild(child) {
        return wrapAdminQuery(q.orderByChild(child));
      },
      equalTo(value) {
        return wrapAdminQuery(q.equalTo(value as string | number | boolean | null));
      },
      limitToLast(n) {
        return wrapAdminQuery(q.limitToLast(n));
      },
      on(event, callback, errorCallback) {
        const handler = (snap: DataSnapshot) =>
          callback(wrapAdminSnap(snap));
        q.on(event as "child_added" | "value", handler, errorCallback);
        return () => q.off(event as "child_added" | "value", handler);
      },
    };
    return wrapped;
  }

  function wrapAdminSnap(snap: DataSnapshot): RtdbSnapshot {
    return {
      val: () => snap.val() as unknown,
      key: snap.key,
      exists: () => snap.exists(),
      forEach: (cb) => {
        snap.forEach((child) => {
          cb(wrapAdminSnap(child));
          return false;
        });
      },
    };
  }

  const adapter: RtdbAdapter = {
    ref(path: string) {
      return wrapAdminRef(db.ref(path));
    },
  };

  return { adapter };
}

// ── Main factory ──────────────────────────────────────────────────────────────

/**
 * Create a FirebaseProvider for the given config.
 *
 * Client target: uses `firebase/database` + `firebase/auth` (browser).
 * Admin target: uses `firebase-admin` (agent/server). `getCurrentUser()` returns null unless
 * a `uid` is provided in the config; this asymmetry is intentional and documented in FR7.
 */
export async function createFirebaseProvider(
  config: FirebaseProviderConfig,
): Promise<DataProvider> {
  let adapter: RtdbAdapter;
  let auth: RtdbAuth | null = null;
  let adminUid: string | null = null;

  if (config.target === "client") {
    const result = await buildClientAdapter(config);
    adapter = result.adapter;
    auth = result.auth;
  } else {
    const result = await buildAdminAdapter(config);
    adapter = result.adapter;
    adminUid = config.uid ?? null;
  }

  // ── Helper: resolve detector → stationId via /detector_index ─────────────

  async function resolveStationId(detectorId: string): Promise<string | null> {
    const snap = await adapter.ref(Paths.detectorIndex(detectorId)).get();
    if (!snap.exists()) return null;
    const val = snap.val();
    return typeof val === "string" ? val : null;
  }

  // ── Helper: require stationId (throws if detector not found) ─────────────

  async function requireStationId(detectorId: string): Promise<string> {
    const sid = await resolveStationId(detectorId);
    if (sid == null) {
      throw new Error(`Detector not found in index: ${detectorId}`);
    }
    return sid;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  async function getCurrentUser(): Promise<User | null> {
    if (config.target === "admin") {
      if (adminUid == null) return null;
      const snap = await adapter.ref(Paths.user(adminUid)).get();
      return deserializeUser(adminUid, snap.val());
    }
    // Client target
    const uid = auth?.currentUser?.uid ?? null;
    if (uid == null) return null;
    const snap = await adapter.ref(Paths.user(uid)).get();
    return deserializeUser(uid, snap.val());
  }

  // ── Institutions ──────────────────────────────────────────────────────────

  async function upsertInstitution(institution: Institution): Promise<void> {
    // Validate before writing (FR6).
    InstitutionSchema.parse(institution);
    await adapter
      .ref(Paths.institution(institution.id))
      .set(serializeInstitution(institution));
  }

  async function getInstitution(id: string): Promise<Institution | null> {
    const snap = await adapter.ref(Paths.institution(id)).get();
    return deserializeInstitution(id, snap.val());
  }

  // ── Stations ──────────────────────────────────────────────────────────────

  /**
   * List stations, applying server-side filters where RTDB allows and client-side for the rest.
   *
   * Server-side (via .indexOn / orderByChild):
   *   - visibility: if filter.visibility is set, use orderByChild("visibility").equalTo(...)
   *   - ownerUid: orderByChild("ownerUid").equalTo(...)
   * Client-side (no geoquery in RTDB):
   *   - institutionId, country, bbox
   * Note: applying multiple server-side filters simultaneously requires multiple RTDB queries;
   * this implementation prioritises visibility first, then ownerUid, and applies the rest
   * client-side. bbox is explicitly client-side (RTDB has no geoquery).
   */
  async function listStations(filter?: StationFilter): Promise<Station[]> {
    let q: RtdbRef = adapter.ref(Paths.stations());

    if (filter?.visibility != null) {
      q = q.orderByChild("visibility").equalTo(filter.visibility);
    } else if (filter?.ownerUid != null) {
      q = q.orderByChild("ownerUid").equalTo(filter.ownerUid);
    }

    const snap = await q.get();
    const stations: Station[] = [];

    snap.forEach((child) => {
      const id = child.key;
      if (id == null) return;
      const station = deserializeStation(id, child.val());
      if (station == null) return;

      // Client-side filters
      if (
        filter?.institutionId !== undefined &&
        station.institutionId !== filter.institutionId
      )
        return;
      if (filter?.country != null && station.country !== filter.country) return;
      if (filter?.ownerUid != null && filter.visibility == null && station.ownerUid !== filter.ownerUid)
        return;
      if (filter?.bbox != null) {
        const [west, south, east, north] = filter.bbox;
        if (
          station.longitude < west ||
          station.longitude > east ||
          station.latitude < south ||
          station.latitude > north
        )
          return;
      }

      stations.push(station);
    });

    return stations;
  }

  async function getStation(id: string): Promise<Station | null> {
    const snap = await adapter.ref(Paths.station(id)).get();
    return deserializeStation(id, snap.val());
  }

  async function upsertStation(station: Station): Promise<void> {
    StationSchema.parse(station);
    await adapter.ref(Paths.station(station.id)).set(serializeStation(station));
  }

  async function deleteStation(id: string): Promise<void> {
    await adapter.ref(Paths.station(id)).set(null);
  }

  // ── Detectors ─────────────────────────────────────────────────────────────

  async function listDetectors(stationId: string): Promise<Detector[]> {
    const snap = await adapter.ref(Paths.detectors(stationId)).get();
    const detectors: Detector[] = [];
    snap.forEach((child) => {
      const id = child.key;
      if (id == null) return;
      const det = deserializeDetector(id, stationId, child.val());
      if (det != null) detectors.push(det);
    });
    return detectors;
  }

  async function getDetector(id: string): Promise<Detector | null> {
    const stationId = await resolveStationId(id);
    if (stationId == null) return null;
    const snap = await adapter.ref(Paths.detector(stationId, id)).get();
    return deserializeDetector(id, stationId, snap.val());
  }

  async function upsertDetector(detector: Detector): Promise<void> {
    DetectorSchema.parse(detector);
    const updates: Record<string, unknown> = {
      [Paths.detector(detector.stationId, detector.id)]: serializeDetector(detector),
      [Paths.detectorIndex(detector.id)]: detector.stationId,
    };
    // Write detector data and index atomically (multi-location update).
    await adapter.ref("/").update(updates);
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async function listSessions(detectorId: string): Promise<Session[]> {
    const stationId = await requireStationId(detectorId);
    const snap = await adapter.ref(Paths.sessions(stationId, detectorId)).get();
    const sessions: Session[] = [];
    snap.forEach((child) => {
      const id = child.key;
      if (id == null) return;
      const s = deserializeSession(id, detectorId, child.val());
      if (s != null) sessions.push(s);
    });
    return sessions;
  }

  async function upsertSession(session: Session): Promise<void> {
    SessionSchema.parse(session);
    const stationId = await requireStationId(session.detectorId);
    await adapter
      .ref(Paths.session(stationId, session.detectorId, session.id))
      .set(serializeSession(session));
  }

  // ── Time-series ───────────────────────────────────────────────────────────

  async function getMinuteRecords(
    detectorId: string,
    range: TimeRange,
  ): Promise<MinuteRecord[]> {
    const stationId = await requireStationId(detectorId);
    const fromKey = padTs(range.fromTs);
    const toKey = padTs(range.toTs);

    const snap = await adapter
      .ref(Paths.minutes(stationId, detectorId))
      .orderByKey()
      .startAt(fromKey)
      .endAt(toKey)
      .get();

    const records: MinuteRecord[] = [];
    snap.forEach((child) => {
      if (child.key == null) return;
      const r = deserializeMinuteRecord(child.key, child.val());
      if (r != null) records.push(r);
    });
    return records;
  }

  async function pushMinuteRecord(
    detectorId: string,
    record: MinuteRecord,
  ): Promise<void> {
    MinuteRecordSchema.parse(record);
    const stationId = await requireStationId(detectorId);
    const key = padTs(record.ts);
    const minutePath = Paths.minute(stationId, detectorId, record.ts);
    const latestPath = Paths.latest(stationId, detectorId);

    const serialized = serializeMinuteRecord(record);

    // Write the minute record (idempotent: same ts → same key → overwrites identically).
    await adapter.ref(minutePath).set(serialized);

    // Update `latest` only if this record's ts ≥ current latest ts (FR3).
    await adapter.ref(latestPath).transaction((current: unknown) => {
      if (current == null) return serialized;
      const currentTs = (current as Record<string, unknown>)["ts"];
      if (typeof currentTs === "number" && currentTs > record.ts) {
        return current; // keep existing
      }
      // Also check padded key comparison for safety.
      const currentKey =
        typeof currentTs === "number" ? padTs(currentTs) : null;
      if (currentKey != null && currentKey > key) return current;
      return serialized;
    });
  }

  async function getLatest(detectorId: string): Promise<MinuteRecord | null> {
    const stationId = await resolveStationId(detectorId);
    if (stationId == null) return null;
    const snap = await adapter.ref(Paths.latest(stationId, detectorId)).get();
    if (!snap.exists()) return null;
    const raw = snap.val();
    if (raw == null || typeof raw !== "object") return null;
    const rawObj = raw as Record<string, unknown>;
    const result = MinuteRecordSchema.safeParse(rawObj);
    if (!result.success) {
      warn(`latest(${detectorId}) parse failed`, result.error.message);
      return null;
    }
    return result.data;
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to realtime events using limitToLast + child_added (FR4).
   * A late subscriber does not re-download history; only events after subscription arrive.
   * The returned Unsubscribe is idempotent.
   */
  function subscribeRealtime(
    detectorId: string,
    callback: RealtimeCallback,
  ): Unsubscribe {
    let detached = false;
    let offFn: (() => void) | null = null;

    // We resolve the stationId asynchronously; events that arrive before resolution are
    // delivered after it resolves. Events that arrive after unsubscribe() are dropped.
    resolveStationId(detectorId)
      .then((stationId) => {
        if (detached || stationId == null) return;

        const realtimeRef = adapter
          .ref(Paths.realtime(stationId, detectorId))
          .limitToLast(1);

        let isFirst = true;
        offFn = realtimeRef.on("child_added", (snap) => {
          // Skip the first snapshot emitted for the existing tail record (limitToLast(1))
          // so we only deliver new events. After the first "catch-up" event we allow all.
          if (isFirst) {
            isFirst = false;
            return;
          }
          if (detached) return;
          if (snap.key == null) return;
          const r = deserializeRealtimeRecord(snap.key, snap.val());
          if (r != null) callback(r);
        });
      })
      .catch((err: unknown) => {
        warn(`subscribeRealtime(${detectorId}) setup error`, err);
      });

    return function unsubscribe() {
      if (detached) return;
      detached = true;
      if (offFn != null) {
        offFn();
        offFn = null;
      }
    };
  }

  async function pushRealtimeRecord(
    detectorId: string,
    record: RealtimeRecord,
  ): Promise<void> {
    RealtimeRecordSchema.parse(record);
    const stationId = await requireStationId(detectorId);
    const key = padTs(record.ts);
    await adapter
      .ref(Paths.realtime(stationId, detectorId))
      .child(key)
      .set(serializeRealtimeRecord(record));
    // Best-effort cap: prune oldest records if over cap.
    // This is a fire-and-forget; cap enforcement is a best-effort operation (spec §4).
    void pruneRealtimeCap(stationId, detectorId);
  }

  async function pruneRealtimeCap(
    stationId: string,
    detectorId: string,
  ): Promise<void> {
    try {
      const ref = adapter.ref(Paths.realtime(stationId, detectorId));
      const snap = await ref.get();
      const keys: string[] = [];
      snap.forEach((child) => {
        if (child.key != null) keys.push(child.key);
      });
      if (keys.length <= REALTIME_CAP) return;
      const toDelete = keys.slice(0, keys.length - REALTIME_CAP);
      const updates: Record<string, null> = {};
      for (const k of toDelete) {
        updates[`${Paths.realtime(stationId, detectorId)}/${k}`] = null;
      }
      await adapter.ref("/").update(updates as Record<string, unknown>);
    } catch (err) {
      warn("pruneRealtimeCap failed (non-critical)", err);
    }
  }

  // ── Export / Import ───────────────────────────────────────────────────────

  /**
   * Stream the dataset as DataChunks without holding it all in memory.
   * Pages through each collection by key ranges (EXPORT_PAGE_SIZE at a time).
   * Supports detectorIds, includeRealtime, sinceTs filters.
   */
  async function* exportAll(options?: ExportOptions): AsyncIterable<DataChunk> {
    const { detectorIds, includeRealtime = false, sinceTs } = options ?? {};

    // Institutions
    yield* exportCollection<Institution>(
      Paths.institution(""),
      (id, raw) => deserializeInstitution(id, raw),
      (inst) => ({ kind: "institution", data: inst }),
      null,
    );

    // Stations
    const stationsSnap = await adapter.ref(Paths.stations()).get();
    const stationIds: string[] = [];
    stationsSnap.forEach((child) => {
      if (child.key != null) stationIds.push(child.key);
    });

    for (const stationId of stationIds) {
      const stationSnap = await adapter.ref(Paths.station(stationId)).get();
      const station = deserializeStation(stationId, stationSnap.val());
      if (station != null) {
        yield { kind: "station", data: station };
      }

      // Detectors under this station
      const detectorsSnap = await adapter.ref(Paths.detectors(stationId)).get();
      const localDetIds: string[] = [];
      detectorsSnap.forEach((child) => {
        if (child.key != null) localDetIds.push(child.key);
      });

      for (const detId of localDetIds) {
        if (detectorIds != null && !detectorIds.includes(detId)) continue;

        const detSnap = await adapter
          .ref(Paths.detector(stationId, detId))
          .get();
        const det = deserializeDetector(detId, stationId, detSnap.val());
        if (det != null) yield { kind: "detector", data: det };

        // Sessions
        const sessionsSnap = await adapter
          .ref(Paths.sessions(stationId, detId))
          .get();
        sessionsSnap.forEach((child) => {
          if (child.key == null) return;
          const s = deserializeSession(child.key, detId, child.val());
          if (s != null) {
            // TS narrowing: reassign to typed var
            const session: Session = s;
            // Yield later (can't yield inside forEach)
            void session; // silence the lint warning — we collect below
          }
        });
        // Collect sessions separately (forEach can't be async)
        const allSessions: Session[] = [];
        sessionsSnap.forEach((child) => {
          if (child.key == null) return;
          const s = deserializeSession(child.key, detId, child.val());
          if (s != null) allSessions.push(s);
        });
        for (const s of allSessions) {
          yield { kind: "session", detectorId: detId, data: s };
        }

        // Minutes — paged
        yield* exportMinutesPaged(stationId, detId, sinceTs);

        // Realtime (optional)
        if (includeRealtime) {
          yield* exportRealtimePaged(stationId, detId);
        }
      }
    }
  }

  async function* exportCollection<T>(
    _basePath: string,
    _deserialize: (id: string, raw: unknown) => T | null,
    _toChunk: (item: T) => DataChunk,
    _sinceTs: number | null,
  ): AsyncIterable<DataChunk> {
    // Placeholder — institutions don't have a list endpoint in RTDB (no indexing by default).
    // We export all institutions by fetching the root institutions node.
    const snap = await adapter.ref("institutions").get();
    snap.forEach((child) => {
      // collected below
      void child;
    });
    const items: T[] = [];
    snap.forEach((child) => {
      if (child.key == null) return;
      const item = _deserialize(child.key, child.val());
      if (item != null) items.push(item);
    });
    for (const item of items) {
      yield _toChunk(item);
    }
  }

  async function* exportMinutesPaged(
    stationId: string,
    detId: string,
    sinceTs?: number,
  ): AsyncIterable<DataChunk> {
    let lastKey: string | null = sinceTs != null ? padTs(sinceTs) : null;

    while (true) {
      let q = adapter
        .ref(Paths.minutes(stationId, detId))
        .orderByKey()
        .limitToLast(EXPORT_PAGE_SIZE);
      if (lastKey != null) {
        q = q.startAt(lastKey);
      }

      const snap = await q.get();
      const records: MinuteRecord[] = [];
      snap.forEach((child) => {
        if (child.key == null) return;
        const r = deserializeMinuteRecord(child.key, child.val());
        if (r != null) records.push(r);
      });

      if (records.length === 0) break;

      for (const r of records) {
        yield { kind: "minute", detectorId: detId, data: r };
      }

      const lastRecord = records[records.length - 1];
      if (lastRecord == null) break;
      const newLastKey = padTs(lastRecord.ts);
      if (newLastKey === lastKey) break; // no progress
      lastKey = newLastKey;

      if (records.length < EXPORT_PAGE_SIZE) break;
    }
  }

  async function* exportRealtimePaged(
    stationId: string,
    detId: string,
  ): AsyncIterable<DataChunk> {
    let lastKey: string | null = null;

    while (true) {
      let q = adapter
        .ref(Paths.realtime(stationId, detId))
        .orderByKey()
        .limitToLast(EXPORT_PAGE_SIZE);
      if (lastKey != null) {
        q = q.startAt(lastKey);
      }

      const snap = await q.get();
      const records: RealtimeRecord[] = [];
      snap.forEach((child) => {
        if (child.key == null) return;
        const r = deserializeRealtimeRecord(child.key, child.val());
        if (r != null) records.push(r);
      });

      if (records.length === 0) break;

      for (const r of records) {
        yield { kind: "realtime", detectorId: detId, data: r };
      }

      const lastRecord = records[records.length - 1];
      if (lastRecord == null) break;
      const newLastKey = padTs(lastRecord.ts);
      if (newLastKey === lastKey) break;
      lastKey = newLastKey;

      if (records.length < EXPORT_PAGE_SIZE) break;
    }
  }

  /**
   * Ingest a chunk stream; idempotent & resumable by natural key.
   * Validates every chunk against the shared zod schema; invalid chunks are quarantined.
   */
  async function importAll(chunks: AsyncIterable<DataChunk>): Promise<ImportReport> {
    let imported = 0;
    let quarantined = 0;
    let stationsWithoutMetadata = 0;
    const errors: string[] = [];

    for await (const chunk of chunks) {
      try {
        switch (chunk.kind) {
          case "institution": {
            const result = InstitutionSchema.safeParse(chunk.data);
            if (!result.success) {
              quarantined++;
              errors.push(`institution: ${result.error.message}`);
              break;
            }
            await upsertInstitution(result.data);
            imported++;
            break;
          }
          case "station": {
            const result = StationSchema.safeParse(chunk.data);
            if (!result.success) {
              quarantined++;
              errors.push(`station: ${result.error.message}`);
              break;
            }
            // Check for missing mandatory metadata (visibility is always required by zod;
            // check for missing location fields that are optional in migration context).
            const s = result.data;
            if (
              s.city === "" ||
              s.country === "" ||
              isNaN(s.latitude) ||
              isNaN(s.longitude)
            ) {
              stationsWithoutMetadata++;
            }
            await upsertStation(result.data);
            imported++;
            break;
          }
          case "detector": {
            const result = DetectorSchema.safeParse(chunk.data);
            if (!result.success) {
              quarantined++;
              errors.push(`detector: ${result.error.message}`);
              break;
            }
            await upsertDetector(result.data);
            imported++;
            break;
          }
          case "session": {
            const result = SessionSchema.safeParse(chunk.data);
            if (!result.success) {
              quarantined++;
              errors.push(`session: ${result.error.message}`);
              break;
            }
            await upsertSession(result.data);
            imported++;
            break;
          }
          case "minute": {
            const result = MinuteRecordSchema.safeParse(chunk.data);
            if (!result.success) {
              quarantined++;
              errors.push(`minute: ${result.error.message}`);
              break;
            }
            await pushMinuteRecord(chunk.detectorId, result.data);
            imported++;
            break;
          }
          case "realtime": {
            const result = RealtimeRecordSchema.safeParse(chunk.data);
            if (!result.success) {
              quarantined++;
              errors.push(`realtime: ${result.error.message}`);
              break;
            }
            await pushRealtimeRecord(chunk.detectorId, result.data);
            imported++;
            break;
          }
        }
      } catch (err) {
        quarantined++;
        errors.push(`chunk(${chunk.kind}): ${String(err)}`);
      }
    }

    return { imported, quarantined, stationsWithoutMetadata, errors };
  }

  // ── Provider object ───────────────────────────────────────────────────────

  return {
    getCurrentUser,
    upsertInstitution,
    getInstitution,
    listStations,
    getStation,
    upsertStation,
    deleteStation,
    listDetectors,
    getDetector,
    upsertDetector,
    listSessions,
    upsertSession,
    getMinuteRecords,
    pushMinuteRecord,
    getLatest,
    subscribeRealtime,
    pushRealtimeRecord,
    exportAll,
    importAll,
  };
}
