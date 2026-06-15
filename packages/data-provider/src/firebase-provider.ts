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
  Language,
  Institution,
  Station,
  Detector,
  Session,
  MinuteRecord,
  RealtimeRecord,
} from "@munhub/shared";
import {
  UserSchema,
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
  AuthErrorCode,
} from "./types.js";
import { AuthProviderError } from "./types.js";
import { Paths, padTs } from "./firebase-paths.js";
import {
  serializeUser,
  serializeInstitution,
  deserializeInstitution,
  serializeStation,
  deserializeStation,
  serializeDetector,
  deserializeDetector,
  serializeSession,
  deserializeSession,
  serializeMinuteRecord,
  serializeLatestMinuteRecord,
  deserializeMinuteRecord,
  deserializeLatestMinuteRecord,
  serializeRealtimeRecord,
  deserializeRealtimeRecord,
  warn,
} from "./firebase-serializer.js";
import { deserializeUser } from "./firebase-serializer.js";
// Type-only imports — erased at compile time, so they never pull the admin SDK
// into the client bundle. Runtime values come from dynamic import() below.
import type { App, ServiceAccount } from "firebase-admin/app";
import type * as FirebaseAdminApp from "firebase-admin/app";
import type { Reference, DataSnapshot, Query } from "firebase-admin/database";
import type * as FirebaseAdminDatabase from "firebase-admin/database";

// ── RTDB page size for exportAll (avoids loading entire dataset in memory) ────
const EXPORT_PAGE_SIZE = 500;

// ── Realtime window (cap old records on push, per spec §4) ────────────────────
export const REALTIME_CAP = 5000;
const REALTIME_PRUNE_BATCH_SIZE = 256;

const AUTH_STATE_USER_READ_ATTEMPTS = 10;
const AUTH_STATE_USER_READ_DELAY_MS = 50;

const connectedDatabaseEmulators = new WeakSet<object>();
const connectedAuthEmulators = new WeakSet<object>();
const realtimeRecordCounts = new Map<string, number>();

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
  limitToFirst(n: number): RtdbQuery;
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

interface AuthProfileInput {
  displayName: string;
  language: Language;
}

interface AuthUserSnapshot {
  uid: string;
  email: string;
  emailVerified: boolean;
}

/** Interactive auth interface for the client target only. */
interface AuthAdapter {
  currentUserUid(): string | null;
  register(email: string, password: string): Promise<AuthUserSnapshot>;
  signIn(email: string, password: string): Promise<AuthUserSnapshot>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  deleteCurrentUser(): Promise<void>;
  onAuthStateChanged(cb: (user: AuthUserSnapshot | null) => void): Unsubscribe;
}

// ── Adapter interfaces (one per SDK target) ───────────────────────────────────

interface RtdbAdapter {
  ref(path: string): RtdbRef;
}

function isBrowserRuntime(): boolean {
  return typeof globalThis === "object" && "document" in globalThis;
}

function parseEmulatorHost(value: string | undefined): { host: string; port: number } | null {
  if (value == null || value.trim() === "") return null;
  try {
    const parsed = new URL(`http://${value}`);
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port <= 0) return null;
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

function authErrorMessage(code: AuthErrorCode): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email address.";
    case "auth/invalid-credential":
      return "The email or password is incorrect.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/network-request-failed":
      return "The auth service could not be reached. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "This authentication operation is not enabled.";
    case "auth/persistence-unavailable":
      return "The browser could not persist the auth session.";
    case "auth/requires-recent-login":
      return "Please sign in again before continuing.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/unsupported":
      return "Interactive authentication is not supported by this provider target.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-record-not-found":
      return "The authenticated account is missing its MunHub user profile.";
    case "auth/weak-password":
      return "Choose a stronger password.";
    case "auth/internal":
      return "Authentication failed. Try again or contact support.";
  }
}

function normalizeAuthCode(rawCode: string | null): AuthErrorCode {
  switch (rawCode) {
    case "auth/email-already-in-use":
    case "auth/invalid-email":
    case "auth/network-request-failed":
    case "auth/operation-not-allowed":
    case "auth/requires-recent-login":
    case "auth/too-many-requests":
    case "auth/user-disabled":
    case "auth/weak-password":
      return rawCode;
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
    case "auth/invalid-password":
    case "auth/invalid-credential":
      return "auth/invalid-credential";
    case "auth/popup-blocked":
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "auth/operation-not-allowed";
    default:
      return "auth/internal";
  }
}

function authCodeFromError(err: unknown): string | null {
  if (err == null || typeof err !== "object" || !("code" in err)) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function toAuthProviderError(err: unknown): AuthProviderError {
  if (err instanceof AuthProviderError) return err;
  const code = normalizeAuthCode(authCodeFromError(err));
  return new AuthProviderError(code, authErrorMessage(code));
}

function unsupportedAuthError(): AuthProviderError {
  return new AuthProviderError("auth/unsupported", authErrorMessage("auth/unsupported"));
}

function authUserFromFirebaseUser(rawUser: {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}): AuthUserSnapshot {
  if (rawUser.email == null) {
    throw new AuthProviderError("auth/internal", authErrorMessage("auth/internal"));
  }
  return {
    uid: rawUser.uid,
    email: rawUser.email,
    emailVerified: rawUser.emailVerified,
  };
}

function usernameFromEmail(email: string, uid: string): string {
  const localPart = email.split("@")[0] ?? "user";
  const base = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeBase = base.length >= 3 ? base : "user";
  const safeUid = uid
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "")
    .slice(0, 8);
  const suffix = safeUid.length > 0 ? `-${safeUid}` : "";
  const maxBaseLength = Math.max(3, 30 - suffix.length);
  return `${safeBase.slice(0, maxBaseLength)}${suffix}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshotKeys(snap: RtdbSnapshot): string[] {
  const keys: string[] = [];
  snap.forEach((child) => {
    if (child.key != null) keys.push(child.key);
  });
  return keys;
}

function realtimeRecordCountKey(stationId: string, detectorId: string): string {
  return `${stationId}/${detectorId}`;
}

async function runtimeImport<TModule>(specifier: string): Promise<TModule> {
  return (await import(/* webpackIgnore: true */ specifier)) as TModule;
}

// ── Client SDK adapter ────────────────────────────────────────────────────────

async function buildClientAdapter(
  config: FirebaseClientConfig,
): Promise<{ adapter: RtdbAdapter; auth: AuthAdapter }> {
  // Dynamic import so the admin bundle never pulls in the client SDK.
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const {
    getDatabase,
    ref,
    get,
    set,
    update,
    push,
    onChildAdded,
    onValue,
    off,
    query,
    orderByKey,
    orderByChild,
    equalTo,
    startAt,
    endAt,
    limitToFirst,
    limitToLast,
    runTransaction,
    connectDatabaseEmulator,
  } = await import("firebase/database");
  const {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut: firebaseSignOut,
    sendPasswordResetEmail,
    onAuthStateChanged: onFirebaseAuthStateChanged,
    deleteUser,
    connectAuthEmulator,
  } = await import("firebase/auth");

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
  const databaseEmulator = parseEmulatorHost(process.env["FIREBASE_DATABASE_EMULATOR_HOST"]);
  if (databaseEmulator != null && !connectedDatabaseEmulators.has(db)) {
    connectDatabaseEmulator(db, databaseEmulator.host, databaseEmulator.port);
    connectedDatabaseEmulators.add(db);
  }

  const authEmulator = parseEmulatorHost(process.env["FIREBASE_AUTH_EMULATOR_HOST"]);
  if (authEmulator != null && !connectedAuthEmulators.has(firebaseAuth)) {
    connectAuthEmulator(firebaseAuth, `http://${authEmulator.host}:${authEmulator.port}`, {
      disableWarnings: true,
    });
    connectedAuthEmulators.add(firebaseAuth);
  }

  if (isBrowserRuntime()) {
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
    } catch {
      throw new AuthProviderError(
        "auth/persistence-unavailable",
        authErrorMessage("auth/persistence-unavailable"),
      );
    }
  }

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
      limitToFirst(n) {
        return wrapQuery(query(rawRef, limitToFirst(n)));
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
      limitToFirst(n) {
        return wrapQuery(query(q, limitToFirst(n)));
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

  const auth: AuthAdapter = {
    currentUserUid() {
      return firebaseAuth.currentUser?.uid ?? null;
    },
    async register(email, password) {
      try {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        return authUserFromFirebaseUser(credential.user);
      } catch (err) {
        throw toAuthProviderError(err);
      }
    },
    async signIn(email, password) {
      try {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        return authUserFromFirebaseUser(credential.user);
      } catch (err) {
        throw toAuthProviderError(err);
      }
    },
    async signOut() {
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (err) {
        throw toAuthProviderError(err);
      }
    },
    async sendPasswordReset(email) {
      try {
        await sendPasswordResetEmail(firebaseAuth, email);
      } catch (err) {
        throw toAuthProviderError(err);
      }
    },
    async deleteCurrentUser() {
      const current = firebaseAuth.currentUser;
      if (current == null) return;
      try {
        await deleteUser(current);
      } catch (err) {
        throw toAuthProviderError(err);
      }
    },
    onAuthStateChanged(cb) {
      return onFirebaseAuthStateChanged(firebaseAuth, (user) => {
        cb(user == null ? null : authUserFromFirebaseUser(user));
      });
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
    await runtimeImport<typeof FirebaseAdminApp>("firebase-admin/app");
  const { getDatabase } =
    await runtimeImport<typeof FirebaseAdminDatabase>("firebase-admin/database");

  // Against the emulator (emulators:exec sets FIREBASE_DATABASE_EMULATOR_HOST),
  // the admin SDK needs no real credential: initialize with just the databaseURL.
  const usingEmulator = Boolean(process.env["FIREBASE_DATABASE_EMULATOR_HOST"]);

  const existing = getApps().find((a: App) => a.name === "munhub-admin");
  const app: App =
    existing ??
    initializeApp(
      usingEmulator && !config.serviceAccount
        ? { databaseURL: config.databaseURL }
        : {
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
      limitToFirst(n) {
        return wrapAdminQuery(rawRef.limitToFirst(n));
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
      limitToFirst(n) {
        return wrapAdminQuery(q.limitToFirst(n));
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
  let auth: AuthAdapter | null = null;
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

  function requireAuthAdapter(): AuthAdapter {
    if (auth == null) throw unsupportedAuthError();
    return auth;
  }

  async function readUserRecord(uid: string): Promise<User | null> {
    const snap = await adapter.ref(Paths.user(uid)).get();
    return deserializeUser(uid, snap.val());
  }

  async function requireUserRecord(uid: string): Promise<User> {
    const user = await readUserRecord(uid);
    if (user == null) {
      throw new AuthProviderError(
        "auth/user-record-not-found",
        authErrorMessage("auth/user-record-not-found"),
      );
    }
    return user;
  }

  async function readUserRecordWithRetry(uid: string): Promise<User | null> {
    for (let attempt = 0; attempt < AUTH_STATE_USER_READ_ATTEMPTS; attempt++) {
      const user = await readUserRecord(uid);
      if (user != null) return user;
      await sleep(AUTH_STATE_USER_READ_DELAY_MS);
    }
    return null;
  }

  function buildRegisteredUser(authUser: AuthUserSnapshot, profile: AuthProfileInput): User {
    return UserSchema.parse({
      uid: authUser.uid,
      email: authUser.email,
      username: usernameFromEmail(authUser.email, authUser.uid),
      displayName: profile.displayName,
      role: "user",
      institutionId: null,
      language: profile.language,
      emailVerified: authUser.emailVerified,
      mlTrainingOptOut: false,
      directoryOptIn: false,
      createdAt: Date.now(),
    });
  }

  async function getCurrentUser(): Promise<User | null> {
    if (config.target === "admin") {
      if (adminUid == null) return null;
      return readUserRecord(adminUid);
    }
    // Client target
    const uid = auth?.currentUserUid() ?? null;
    if (uid == null) return null;
    return readUserRecord(uid);
  }

  async function register(
    email: string,
    password: string,
    profile: AuthProfileInput,
  ): Promise<User> {
    const authAdapter = requireAuthAdapter();
    let createdAuthUser = false;
    try {
      const authUser = await authAdapter.register(email, password);
      createdAuthUser = true;
      const user = buildRegisteredUser(authUser, profile);
      await adapter.ref(Paths.user(user.uid)).set(serializeUser(user));
      return user;
    } catch (err) {
      if (createdAuthUser) {
        try {
          await authAdapter.deleteCurrentUser();
        } catch (rollbackErr) {
          warn("register rollback failed after user profile write error", rollbackErr);
        }
      }
      throw toAuthProviderError(err);
    }
  }

  async function signIn(email: string, password: string): Promise<User> {
    const authAdapter = requireAuthAdapter();
    const authUser = await authAdapter.signIn(email, password);
    return requireUserRecord(authUser.uid);
  }

  async function signOut(): Promise<void> {
    await requireAuthAdapter().signOut();
  }

  async function sendPasswordReset(email: string): Promise<void> {
    await requireAuthAdapter().sendPasswordReset(email);
  }

  function onAuthStateChanged(cb: (user: User | null) => void): Unsubscribe {
    const authAdapter = requireAuthAdapter();
    return authAdapter.onAuthStateChanged((authUser) => {
      if (authUser == null) {
        cb(null);
        return;
      }
      void readUserRecordWithRetry(authUser.uid)
        .then((user) => cb(user))
        .catch((err: unknown) => {
          warn("onAuthStateChanged user resolution failed", err);
          cb(null);
        });
    });
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
    const serializedLatest = serializeLatestMinuteRecord(record);

    // Write the minute record (idempotent: same ts → same key → overwrites identically).
    await adapter.ref(minutePath).set(serialized);

    // Update `latest` only if this record's ts ≥ current latest ts (FR3).
    await adapter.ref(latestPath).transaction((current: unknown) => {
      if (current == null) return serializedLatest;
      const currentTs = (current as Record<string, unknown>)["ts"];
      if (typeof currentTs === "number" && currentTs > record.ts) {
        return current; // keep existing
      }
      // Also check padded key comparison for safety.
      const currentKey =
        typeof currentTs === "number" ? padTs(currentTs) : null;
      if (currentKey != null && currentKey > key) return current;
      return serializedLatest;
    });
  }

  async function getLatest(detectorId: string): Promise<MinuteRecord | null> {
    const stationId = await resolveStationId(detectorId);
    if (stationId == null) return null;
    const snap = await adapter.ref(Paths.latest(stationId, detectorId)).get();
    if (!snap.exists()) return null;
    return deserializeLatestMinuteRecord(snap.val());
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
      .then(async (stationId) => {
        if (detached || stationId == null) return;

        const base = adapter.ref(Paths.realtime(stationId, detectorId));

        // Baseline = the newest existing key at subscription time (null if the node is empty).
        // We then deliver only events with a strictly greater key, so a late subscriber neither
        // re-downloads history nor — on an empty node — drops its first real event. Keys are
        // zero-padded epoch-ms, so lexical comparison equals chronological order.
        let baselineKey: string | null = null;
        const tail = await base.limitToLast(1).get();
        tail.forEach((c) => {
          baselineKey = c.key;
        });
        if (detached) return;

        offFn = base.limitToLast(1).on("child_added", (snap) => {
          if (detached) return;
          if (snap.key == null) return;
          if (baselineKey != null && snap.key <= baselineKey) return; // catch-up / older
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
    const realtimePath = Paths.realtime(stationId, detectorId);
    const realtimeRef = adapter.ref(realtimePath);
    const recordRef = realtimeRef.child(key);
    const existed = (await recordRef.get()).exists();

    await recordRef.set(serializeRealtimeRecord(record));

    const countKey = realtimeRecordCountKey(stationId, detectorId);
    const cachedCount = realtimeRecordCounts.get(countKey);
    if (cachedCount != null) {
      const nextCount = existed ? cachedCount : cachedCount + 1;
      realtimeRecordCounts.set(countKey, nextCount);
      if (nextCount <= REALTIME_CAP) return;
    } else if (existed) {
      await pruneRealtimeCap(stationId, detectorId);
      return;
    }

    await pruneRealtimeCap(stationId, detectorId);
  }

  /**
   * Realtime retention guarantee: after provider writes, `realtime/{ts}` is bounded to the
   * newest `REALTIME_CAP` records. Pruning keeps the newest keys and deletes older keys via
   * ordered, bounded queries (`limitToLast(REALTIME_CAP)` + oldest-key batches), avoiding a
   * full-node scan on the hot path.
   */
  async function pruneRealtimeCap(
    stationId: string,
    detectorId: string,
  ): Promise<void> {
    const countKey = realtimeRecordCountKey(stationId, detectorId);
    try {
      const realtimePath = Paths.realtime(stationId, detectorId);
      const ref = adapter.ref(realtimePath);
      const retainedKeys = snapshotKeys(
        await ref.orderByKey().limitToLast(REALTIME_CAP).get(),
      );

      if (retainedKeys.length < REALTIME_CAP) {
        realtimeRecordCounts.set(countKey, retainedKeys.length);
        return;
      }

      const oldestRetainedKey = retainedKeys[0];
      if (oldestRetainedKey == null) {
        realtimeRecordCounts.set(countKey, 0);
        return;
      }

      while (true) {
        const oldestKeys = snapshotKeys(
          await ref
            .orderByKey()
            .limitToFirst(REALTIME_PRUNE_BATCH_SIZE)
            .get(),
        );
        const toDelete = oldestKeys.filter((oldestKey) => oldestKey < oldestRetainedKey);
        if (toDelete.length === 0) break;

        const updates: Record<string, null> = {};
        for (const deleteKey of toDelete) {
          updates[`${realtimePath}/${deleteKey}`] = null;
        }
        await adapter.ref("/").update(updates as Record<string, unknown>);

        if (toDelete.length < REALTIME_PRUNE_BATCH_SIZE) break;
      }

      realtimeRecordCounts.set(countKey, REALTIME_CAP);
    } catch (err) {
      realtimeRecordCounts.delete(countKey);
      throw err;
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
    register,
    signIn,
    signOut,
    sendPasswordReset,
    onAuthStateChanged,
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
