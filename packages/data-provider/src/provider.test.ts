import { describe, it, expect } from "vitest";
import type { DataProvider } from "./provider.js";
import type { DataChunk } from "./types.js";
import { AuthProviderError } from "./types.js";

/**
 * A trivial in-memory mock typed as `DataProvider`. If the interface is internally inconsistent or
 * misaligned with `@munhub/shared`, this file fails to compile — that is the point of the test.
 */
function createMockProvider(): DataProvider {
  return {
    getCurrentUser: async () => null,
    register: async (email, _password, profile) => ({
      uid: "mock-user",
      email,
      username: "mock-user",
      displayName: profile.displayName,
      role: "user",
      institutionId: null,
      language: profile.language,
      emailVerified: false,
      mlTrainingOptOut: false,
      directoryOptIn: false,
    }),
    signIn: async () => {
      throw new AuthProviderError("auth/invalid-credential", "Invalid credentials.");
    },
    signOut: async () => undefined,
    sendPasswordReset: async () => undefined,
    onAuthStateChanged: (cb) => {
      cb(null);
      return () => undefined;
    },
    upsertInstitution: async () => undefined,
    getInstitution: async () => null,
    listStations: async () => [],
    getStation: async () => null,
    upsertStation: async () => undefined,
    deleteStation: async () => undefined,
    listDetectors: async () => [],
    getDetector: async () => null,
    upsertDetector: async () => undefined,
    listSessions: async () => [],
    upsertSession: async () => undefined,
    getMinuteRecords: async () => [],
    pushMinuteRecord: async () => undefined,
    getLatest: async () => null,
    subscribeRealtime: () => () => undefined,
    pushRealtimeRecord: async () => undefined,
    exportAll: async function* () {
      /* no chunks in the mock */
    },
    importAll: async (chunks: AsyncIterable<DataChunk>) => {
      let imported = 0;
      for await (const chunk of chunks) {
        if (chunk) imported += 1;
      }
      return { imported, quarantined: 0, stationsWithoutMetadata: 0, errors: [] };
    },
  };
}

describe("DataProvider contract", () => {
  it("is implementable by a conforming object", async () => {
    const provider = createMockProvider();
    expect(await provider.getCurrentUser()).toBeNull();
    expect(await provider.listStations()).toEqual([]);
  });

  it("exposes auth methods with stable provider errors", async () => {
    const provider = createMockProvider();
    const user = await provider.register("test@example.org", "password", {
      displayName: "Test User",
      language: "en",
    });
    expect(user.role).toBe("user");

    await expect(provider.signIn("test@example.org", "bad-password")).rejects.toMatchObject({
      code: "auth/invalid-credential",
    });
  });

  it("supports the streaming export/import round trip shape", async () => {
    const provider = createMockProvider();
    async function* empty(): AsyncIterable<DataChunk> {
      /* no chunks */
    }
    const report = await provider.importAll(empty());
    expect(report.imported).toBe(0);

    const out: DataChunk[] = [];
    for await (const chunk of provider.exportAll()) out.push(chunk);
    expect(out).toEqual([]);
  });

  it("returns an idempotent unsubscribe from a realtime subscription", () => {
    const provider = createMockProvider();
    const unsub = provider.subscribeRealtime("d_1", () => undefined);
    expect(() => {
      unsub();
      unsub();
    }).not.toThrow();
  });
});
