# Adapter — Codex (OpenAI)

> **Last verified:** 2026-06-12 (first adopter's landscape audit). Re-verify quarterly
> (doctrine 3).

## Where it runs

| Surface | Use for |
|---|---|
| **Codex Cloud** (chatgpt.com/codex) | parallel cloud tasks: each task gets a sandboxed clone of the repo and emits a PR |
| **Codex CLI** (local) | single interactive session only, same rule as every local CLI (doctrine 1) |
| **GitHub integration** | task → PR wiring, review-comment round-trips |

## How to start a task

Connect the GitHub repo once; then create a task per work package (paste the WP text).
Tasks run in parallel sandboxes; each ends in a PR. Environment setup (installs, env vars)
is configured per-repo in Codex settings — mirror the CI environment so its local checks
match the referee's.

## Shim wiring

Reads `AGENTS.md` natively — Codex originated the convention, no shim file needed. The
canonical contract IS its instruction file; one more reason the kit keeps `AGENTS.md` as
the single authority (doctrine 5).

## Strengths / routing

A second frontier-lane provider: useful for cross-provider review of Claude-authored
contracts (doctrine 7) and as overflow implementer capacity when Claude/Cursor quotas are
exhausted. Sandbox-per-task isolation makes it safe for risky refactors.

## Cost / billing cautions

Requires a paid ChatGPT plan (Plus/Pro/Team tiers gate task volume); heavy parallel use
hits plan limits — queue waves rather than firing the whole backlog. The first adopter
holds no Codex seat (2026-06): treat this adapter as documented-but-dormant until a seat
exists, and budget for it only if cross-provider review capacity becomes the bottleneck.
