# Playbook — incidents

> Four incident classes, each a numbered procedure with a "done when". Shared rules:
> **stop the bleeding before assigning blame; never destroy evidence (no force-push during
> diagnosis); record the incident and its lesson in the repo afterwards** — doctrine
> entries are born here.

## A. Broken `main`

1. Freeze merges (announce in the PR queue / status board).
2. Identify the breaking merge from CI history — `main` is PR-only, so the culprit is a
   merge commit.
3. Prefer **revert** (a new PR reverting the merge) over force-push; protection should
   forbid force-push anyway.
4. Re-run CI on the revert; merge it (maintainer); unfreeze.
5. Post-incident: why did CI pass on the PR but fail on `main`? (Stale base? Flaky test?
   Missing required check?) Fix the gate, not just the breakage.

**Done when:** `main` is green, the revert PR explains the cause, and the gate gap that
let it through is closed or ticketed.

## B. Rogue agent (off-WP edits, lane violations, policy breaches)

1. Stop the agent's session/task from its provider dashboard.
2. Quarantine its output: the branch stays, nothing merges; label the PR `quarantine`.
3. Audit the branch commit-by-commit for scope violations and anything touching secrets,
   CI config, or contracts.
4. Salvage by cherry-pick onto a fresh branch if any work is sound; otherwise close.
5. Diagnose WHY: underspecified WP (fix the WP — doctrine 4)? missing guardrail in
   `AGENTS.md` (fix the contract + shims)? provider malfunction (note it in the adapter)?

**Done when:** no rogue output can reach `main`, the salvage decision is recorded on the
PR, and the root cause produced a concrete edit to a WP, the contract, or an adapter.

## C. Leaked secret

1. **Rotate first** — the credential is dead from this moment; git history counts as
   exposure even if the file is later deleted. Treat any rotation delay as active risk.
2. Revoke/invalidate the old credential at the provider; check its access logs for use.
3. Remove from the working tree; decide on history rewrite (only if the repo is private
   and small-team; on a public repo assume it was scraped — rotation is the only real fix).
4. Find the leak path: how did it bypass the secret scan? Add the pattern to the scanner
   config and a deny-rule to `AGENTS.md` if an agent wrote it.
5. Record the incident (what leaked, exposure window, rotation time) in the repo.

**Done when:** the old credential no longer works anywhere, the scanner catches the
pattern (test it), and services run on the new credential.

## D. Lost session / lost write access

*The case that wrote this playbook (2026-06-12): a session lost push access mid-wave.*

1. A session that loses its remote (auth expiry, network, provider outage) **keeps
   committing locally** — work continues on the branch; nothing is held in working trees
   or chats.
2. If access does not return before session end: export the work as patches
   (`git format-patch`) or a bundle (`git bundle`) to a location the operator can reach,
   and write the Stage Report into the patch/bundle directory.
3. The operator (or the next session) applies the patches to a fresh branch and opens the
   PR — authorship survives in the patch metadata.
4. A session that simply dies (crash, context loss) is recovered from the repo: pushed
   branches + PR Stage Reports + `docs/STATUS.md` are the only memory that counts
   (doctrine 6). If the loss revealed un-pushed state, the lesson is to push at
   milestones, not at session end only.

**Done when:** every commit the session made is on a remote branch or applied from
patches, the PR + Stage Report exist, and nothing of record lived only in the chat.
