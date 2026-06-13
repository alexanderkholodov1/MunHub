# Playbook — run a wave

> The orchestrator (Adjutant) loop for one wave of parallel agent work, **after the fleet has been
> composed for the milestone** (`compose-fleet.md`). A wave is the execution of a composed plan in
> **disjoint lanes** on cloud surfaces, landing as **one PR per milestone**. Done when the PR is
> merged or explicitly parked and the status board reflects it.

## Preconditions

- [ ] **`compose-fleet.md` has run and the maintainer approved the wave plan** (live roster, task
      tier, composed tree, quota estimate). The wave executes an approved plan — it never invents
      structure on the fly.
- [ ] Contracts the wave depends on are **merged** (contracts-first rule) — never fan out on
      top of an unmerged foundation.
- [ ] Each WP passes the completeness test (work-package.md authoring rules).
- [ ] Lanes are disjoint: no two WPs touch the same package/area; high-contention files
      (status board, changelog, shared contracts) are excluded from worker WPs entirely.
- [ ] The maintainer knows the wave is launching (one line, not a ceremony).

## Procedure

0. **Preflight (hard gate).** Before fanning out, run the executable preflight against the wave
   manifest (reference implementation: `infra/fleet/wave-preflight.ps1` in the adopting repo).
   It must exit 0. It enforces the rest of this checklist mechanically — disjoint lanes, no
   worker touching a high-contention file, every routed executor reachable, no unmerged
   dependency — because a checklist you have to *remember* is the one you skip under load. If
   the gate blocks, fix the manifest; never launch around it.
1. **Route.** Assign each WP an executor by the routing matrix: orchestrator-grade for
   contracts/ambiguity; mid-tier for well-specced implementation; cheap tier for mechanical
   bulk; visual/iterative work to an IDE-native agent. Cloud surfaces only (doctrine rule 1).
   **The orchestrator's own (frontier) quota is the scarcest resource — spend it on research,
   architecture, review and integration, never on mechanical bulk a cheap-tier executor can do.**
2. **Launch.** One agent = one WP = one branch = one PR. Each agent receives its WP text and
   nothing else.
3. **Collect.** As PRs open: confirm CI green, Stage Report present, lane respected. A PR that
   drifted out of lane is closed and its WP re-issued — do not negotiate scope in review.
4. **Review.** Run the persona reviews the WP calls for (code, security, silent-failure,
   domain). Cross-provider where possible: the author is never the only reviewer.
5. **Integrate.** Resolve trivial conflicts by rebasing the branch; structural conflicts mean
   the lanes weren't disjoint — record that as a planning defect, fix the next wave.
6. **Hand to the maintainer.** Present the merge queue in dependency order with one line per
   PR: what it delivers, review state, risk. The maintainer merges; agents never do.
7. **Close the wave.** Update the status board (phases, specs, gates, action queue), compile
   discovered-work proposals from Stage Reports into candidate WPs, report to the maintainer:
   delivered / parked / discovered / next wave proposal.

## Rules of thumb

- A wave that needs >5 WPs is two waves. A WP stuck >2 sessions is misspecced — withdraw it,
  rewrite it, relaunch.
- **PR queue: dependency-aware, not a blind count.** Independent PRs (disjoint lanes, none
  waiting on another's merge) may accumulate up to a review-load ceiling — default **8**,
  tunable per project (`-MaxIndependentPRs`). The moment work becomes *chained* — a wave builds
  on an unmerged PR, or one WP's output feeds the next — **pause and let the maintainer review
  and approve the foundation first** (`dependsOnUnmergedPRs: true` in the manifest blocks the
  gate). The goal is accelerated throughput without a review queue so deep it invites
  rubber-stamping. Never silently pile chained work on the maintainer.
- The status board update is not optional; an unrecorded wave didn't happen (doctrine rule 6).
