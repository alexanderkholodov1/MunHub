/**
 * FirebaseProvider integration tests — run against the Firebase Emulator Suite.
 *
 * Executed only via `pnpm test:emulator` (firebase emulators:exec), which sets
 * FIREBASE_DATABASE_EMULATOR_HOST so the admin target talks to the local emulator,
 * never munhub-1. Excluded from the default `pnpm test` (see vitest.config.ts).
 *
 * Covers spec 0007 acceptance criteria 2 (CRUD + index + minutes + idempotent latest),
 * 3 (incremental realtime), and 4 (streaming export/import round trip + quarantine).
 * Also covers spec 0009 auth flows against the Firebase Auth emulator.
 */
import { describe, it, expect, beforeAll } from "vitest";
import type {
  Institution,
  Station,
  Detector,
  Session,
  MinuteRecord,
  RealtimeRecord,
} from "@munhub/shared";
import { createFirebaseProvider } from "./firebase-provider.js";
import type { DataProvider } from "./provider.js";
import type { DataChunk } from "./types.js";

const emulatorOn = Boolean(process.env["FIREBASE_DATABASE_EMULATOR_HOST"]);
const describeEmu = emulatorOn ? describe : describe.skip;
const databaseURL = "https://demo-munhub-default-rtdb.firebaseio.com";

// ── Fixtures ────────────────────────────────────────────────────────────────────
let seq = 0;
const uid = (p: string) => `${p}_${Date.now()}_${seq++}`;
const authEmail = () => `${uid("auth")}@example.org`;
const authPassword = "CorrectHorse123!";

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function makeStation(id: string, ownerUid: string): Station {
  return {
    id,
    name: `Station ${id}`,
    ownerUid,
    institutionId: null,
    visibility: "public",
    embargoUntil: null,
    latitude: -0.2,
    longitude: -78.5,
    altitudeM: 2850,
    city: "Quito",
    country: "EC",
    placement: "indoor",
    type: "single",
    timezone: "America/Guayaquil",
    shares: [],
  };
}

function makeDetector(id: string, stationId: string): Detector {
  return {
    id,
    stationId,
    deviceToken: `tok_${id}`,
    hardwareModel: "CosmicWatch v3",
    firmwareVersion: "1.0.0",
    hwVersion: "v3X",
    sipmCount: 1,
    status: "active",
  };
}

function makeMinute(ts: number, ec: number): MinuteRecord {
  return {
    ts,
    ec,
    cc: 0,
    sm: 5,
    sx: 9,
    sn: 2,
    tp: 21,
    pr: 1013,
    dt: 1.2,
  };
}

describeEmu("FirebaseProvider (emulator)", () => {
  let provider: DataProvider;

  beforeAll(async () => {
    provider = await createFirebaseProvider({
      target: "admin",
      databaseURL,
    });
  });

  it("round-trips institution, station, detector and session (AC2)", async () => {
    const inst: Institution = {
      id: uid("inst"),
      name: "USFQ",
      country: "EC",
      city: "Quito",
      adminUids: [],
    };
    await provider.upsertInstitution(inst);
    expect((await provider.getInstitution(inst.id))?.name).toBe("USFQ");

    const sid = uid("st");
    const station = makeStation(sid, "owner1");
    await provider.upsertStation(station);
    expect((await provider.getStation(sid))?.city).toBe("Quito");

    const did = uid("det");
    const detector: Detector = {
      id: did,
      stationId: sid,
      deviceToken: `tok_${did}`,
      hardwareModel: "CosmicWatch v3",
      firmwareVersion: "1.0.0",
      hwVersion: "v3X",
      sipmCount: 1,
      status: "active",
    };
    await provider.upsertDetector(detector);

    // Detector is reachable by id (proves /detector_index was written).
    expect((await provider.getDetector(did))?.stationId).toBe(sid);
    expect((await provider.listDetectors(sid)).map((d) => d.id)).toContain(did);

    const session: Session = {
      id: uid("sess"),
      detectorId: did,
      startedAt: Date.now(),
    } as Session;
    await provider.upsertSession(session);
    expect((await provider.listSessions(did)).length).toBeGreaterThanOrEqual(1);
  });

  it("returns in-range minutes in order and keeps latest idempotent (AC2)", async () => {
    const sid = uid("st");
    const did = uid("det");
    await provider.upsertStation(makeStation(sid, "owner1"));
    await provider.upsertDetector(makeDetector(did, sid));

    const t0 = 1_700_000_000_000;
    await provider.pushMinuteRecord(did, makeMinute(t0, 10));
    await provider.pushMinuteRecord(did, makeMinute(t0 + 60_000, 11));
    await provider.pushMinuteRecord(did, makeMinute(t0 + 120_000, 12));

    const got = await provider.getMinuteRecords(did, {
      fromTs: t0,
      toTs: t0 + 60_000,
    });
    expect(got.map((r) => r.ts)).toEqual([t0, t0 + 60_000]);

    // Latest is the newest ts.
    expect((await provider.getLatest(did))?.ts).toBe(t0 + 120_000);

    // Idempotent: re-push same ts → still one record, latest unchanged by an older ts.
    await provider.pushMinuteRecord(did, makeMinute(t0 + 120_000, 99));
    await provider.pushMinuteRecord(did, makeMinute(t0, 5)); // older ts must not move latest
    const all = await provider.getMinuteRecords(did, { fromTs: t0, toTs: t0 + 120_000 });
    expect(all.length).toBe(3);
    expect((await provider.getLatest(did))?.ts).toBe(t0 + 120_000);
    expect((await provider.getLatest(did))?.ec).toBe(99);
  });

  it("delivers only realtime events appended after subscription (AC3)", async () => {
    const sid = uid("st");
    const did = uid("det");
    await provider.upsertStation(makeStation(sid, "owner1"));
    await provider.upsertDetector(makeDetector(did, sid));

    // Seed history BEFORE subscribing.
    const rt = (ts: number): RealtimeRecord => ({ ts, sipmMv: 30 });
    await provider.pushRealtimeRecord(did, rt(1_000));
    await new Promise((r) => setTimeout(r, 200));

    const received: number[] = [];
    const unsub = provider.subscribeRealtime(did, (r) => received.push(r.ts));
    await new Promise((r) => setTimeout(r, 300)); // let the catch-up tail be skipped

    await provider.pushRealtimeRecord(did, rt(2_000));
    await new Promise((r) => setTimeout(r, 250));
    await provider.pushRealtimeRecord(did, rt(3_000));
    await new Promise((r) => setTimeout(r, 250));

    expect(received).not.toContain(1_000); // history not re-delivered
    expect(received).toContain(2_000);
    expect(received).toContain(3_000);

    // Idempotent unsubscribe; no delivery afterwards.
    expect(() => {
      unsub();
      unsub();
    }).not.toThrow();
    await provider.pushRealtimeRecord(did, rt(4_000));
    await new Promise((r) => setTimeout(r, 250));
    expect(received).not.toContain(4_000);
  });

  it("round-trips a dataset through exportAll → importAll and quarantines invalid chunks (AC4)", async () => {
    const sid = uid("st");
    const did = uid("det");
    await provider.upsertStation(makeStation(sid, "owner1"));
    await provider.upsertDetector(makeDetector(did, sid));
    const t0 = 1_800_000_000_000;
    await provider.pushMinuteRecord(did, makeMinute(t0, 10));
    await provider.pushMinuteRecord(did, makeMinute(t0 + 60_000, 11));

    // Export just this detector's slice.
    const chunks: DataChunk[] = [];
    for await (const c of provider.exportAll({ detectorIds: [did] })) chunks.push(c);
    const minuteChunks = chunks.filter((c) => c.kind === "minute");
    expect(minuteChunks.length).toBeGreaterThanOrEqual(2);

    // Re-import the exported chunks: idempotent (no duplication).
    async function* replay(): AsyncIterable<DataChunk> {
      for (const c of chunks) yield c;
    }
    const report1 = await provider.importAll(replay());
    expect(report1.imported).toBeGreaterThanOrEqual(chunks.length - report1.quarantined);
    const minutesAfter = await provider.getMinuteRecords(did, {
      fromTs: t0,
      toTs: t0 + 60_000,
    });
    expect(minutesAfter.length).toBe(2); // not duplicated

    // A schema-invalid chunk is quarantined, not thrown.
    async function* withBad(): AsyncIterable<DataChunk> {
      yield {
        kind: "minute",
        detectorId: did,
        data: { ts: -1, ec: -5 } as unknown as MinuteRecord, // invalid
      };
    }
    const report2 = await provider.importAll(withBad());
    expect(report2.quarantined).toBeGreaterThanOrEqual(1);
    expect(report2.imported).toBe(0);
  });

  it("register creates a Firebase Auth user and /users record (S0009 AC2)", async () => {
    const authProvider = await createFirebaseProvider({
      target: "client",
      apiKey: "demo-key",
      authDomain: "demo-munhub.firebaseapp.com",
      databaseURL,
      projectId: "demo-munhub",
    });
    const email = authEmail();

    const user = await authProvider.register(email, authPassword, {
      displayName: "Quito Researcher",
      language: "es",
    });

    expect(user.email).toBe(email);
    expect(user.role).toBe("user");
    expect(user.language).toBe("es");
    expect(user.displayName).toBe("Quito Researcher");

    const reader = await createFirebaseProvider({
      target: "admin",
      databaseURL,
      uid: user.uid,
    });
    expect(await reader.getCurrentUser()).toMatchObject({
      uid: user.uid,
      email,
      role: "user",
      language: "es",
    });

    await authProvider.signOut();
    expect((await authProvider.signIn(email, authPassword)).uid).toBe(user.uid);
  });

  it("signIn returns the user profile and maps wrong passwords (S0009 AC2)", async () => {
    const authProvider = await createFirebaseProvider({
      target: "client",
      apiKey: "demo-key",
      authDomain: "demo-munhub.firebaseapp.com",
      databaseURL,
      projectId: "demo-munhub",
    });
    const email = authEmail();
    const created = await authProvider.register(email, authPassword, {
      displayName: "Password Test User",
      language: "en",
    });

    await authProvider.signOut();
    await expect(authProvider.signIn(email, "wrong-password")).rejects.toMatchObject({
      code: "auth/invalid-credential",
    });

    const signedIn = await authProvider.signIn(email, authPassword);
    expect(signedIn.uid).toBe(created.uid);
    expect(signedIn.displayName).toBe("Password Test User");
  });

  it("onAuthStateChanged fires on login/logout and signOut clears the session (S0009 AC2)", async () => {
    const authProvider = await createFirebaseProvider({
      target: "client",
      apiKey: "demo-key",
      authDomain: "demo-munhub.firebaseapp.com",
      databaseURL,
      projectId: "demo-munhub",
    });
    const email = authEmail();
    const created = await authProvider.register(email, authPassword, {
      displayName: "Listener Test User",
      language: "pt-BR",
    });
    await authProvider.signOut();
    expect(await authProvider.getCurrentUser()).toBeNull();

    const states: Array<string | null> = [];
    const unsubscribe = authProvider.onAuthStateChanged((user) => {
      states.push(user?.uid ?? null);
    });

    await waitFor(() => states.includes(null), "initial signed-out auth state");
    await authProvider.signIn(email, authPassword);
    await waitFor(() => states.includes(created.uid), "signed-in auth state");

    expect((await authProvider.getCurrentUser())?.uid).toBe(created.uid);
    await authProvider.signOut();
    await waitFor(
      () => states.filter((state) => state === null).length >= 2,
      "signed-out auth state",
    );
    expect(await authProvider.getCurrentUser()).toBeNull();

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });

  it("admin target rejects interactive auth methods as unsupported (S0009)", async () => {
    await expect(
      provider.register("admin-auth@example.org", authPassword, {
        displayName: "Admin Auth",
        language: "en",
      }),
    ).rejects.toMatchObject({ code: "auth/unsupported" });
    await expect(provider.signIn("admin-auth@example.org", authPassword)).rejects.toMatchObject({
      code: "auth/unsupported",
    });
    await expect(provider.signOut()).rejects.toMatchObject({ code: "auth/unsupported" });
    await expect(provider.sendPasswordReset("admin-auth@example.org")).rejects.toMatchObject({
      code: "auth/unsupported",
    });
    expect(() => provider.onAuthStateChanged(() => undefined)).toThrowError(/not supported/i);
  });
});
