/**
 * apps/agent — MunHub Lab local agent stub.
 *
 * Tauri app structure, serial port reading, SQLite local backup, and
 * offline sync queue land in S16 (agent scaffold) and S17 (serial ingestion).
 *
 * The agent is the STANDARD path for data ingestion from a physical detector.
 * Web Serial API (demo-only, Chrome/Edge) is a secondary convenience path.
 *
 * This file only exists to give the TypeScript compiler a source root to validate.
 */

export const AGENT_STUB = "local-agent-stub-v6" as const;
