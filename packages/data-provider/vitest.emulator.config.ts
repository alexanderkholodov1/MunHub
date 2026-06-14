import { defineConfig } from "vitest/config";

// Emulator suite: only `*.emulator.test.ts`, run inside `firebase emulators:exec`
// (see the `test:emulator` script) so FIREBASE_DATABASE_EMULATOR_HOST / _AUTH_EMULATOR_HOST
// are set and the provider talks to the local emulator instead of munhub-1.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.emulator.test.ts"],
    // Emulator state is shared, so keep these serial.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
