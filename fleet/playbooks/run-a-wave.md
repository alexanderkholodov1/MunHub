# Playbook — run a wave

> The orchestrator (Adjutant) loop for one wave of parallel agent work. A wave is 3–5 work
> packages in **disjoint lanes**, executed on cloud surfaces, landing as PRs. Done when every
> WP's PR is merged or explicitly parked, and the status board reflects it.

## Preconditions

- [ ] Contracts the wave depends on are **merged** (contracts-first rule) — never fan out on
      top of an unmerged foundation.
- [ ] Each WP passes the completeness test (work-package.md authoring rules).
- [ ] Lanes are disjoint: no two WPs touch the same package/area; high-contention files
      (status board, changelog, shared contracts) are excluded from worker WPs entirely.
- [ ] The maintainer knows the wave is launching (one line, not a ceremony).

## Procedure

1. **Route.** Assign each WP an executor by the routing matrix: orchestrator-grade for
   contracts/ambiguity; mid-tier for well-specced implementation; cheap tier for mechanical
   bulk; visual/iterative work to an IDE-native agent. Cloud surfaces only (doctrine rule 1).
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
- Never queue work on the maintainer silently: if the merge queue exceeds ~3 PRs, pause
  launching and say so.
- The status board update is not optional; an unrecorded wave didn't happen (doctrine rule 6).
