// @ts-check
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import rootConfig from "../../eslint.config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Next.js recommended rules
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Workspace root config (TypeScript, no-any, etc.)
  ...rootConfig,
  {
    // Override: next lint scans the whole app, not just src/
    ignores: ["node_modules/**", ".next/**", "out/**"],
  },
];
