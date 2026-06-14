import { defineConfig } from "vitest/config";

// Default suite: unit/contract tests only. Emulator-backed tests (`*.emulator.test.ts`)
// are excluded here and run via `pnpm test:emulator`, which starts the Firebase Emulator
// Suite first — so CI's plain `pnpm test` needs no emulator, no Java, and no secrets.
export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.emulator.test.ts"],
  },
});
