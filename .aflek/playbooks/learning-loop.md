# Playbook — learning loop (how AFLEK and its projects self-improve)

> Self-improvement in AFLEK is **a process, not a runtime**: lessons become PRs against
> contracts, templates, personas, playbooks, and memory files — reviewed and merged like any
> other change. This is deliberate (doctrine: kit-not-runtime): runtime self-modification is
> unauditable and rots with vendor churn; reviewed self-modification compounds. Doctrine
> rules themselves were born this way — each one is a paid-for failure that became text.

## The three learning layers

1. **Project layer** (the adopting repo): wave retrospectives → edits to the repo's
   `AGENTS.md` domain guardrails, WP templates, persona footers, and status practices.
2. **Operator layer** (a private fork/overlay of AFLEK, if the operator keeps one): personal
   preferences, recurring stacks, adjutant memory — everything too personal for a public kit.
3. **Kit layer** (this repo): only the **generalizable, anonymized** lessons. Domain truth
   and personal data never flow up (FD5); structure and doctrine never fork down silently
   (use `upgrade-kit-version.md`).

## Procedure (run at every wave close — 10 minutes, not a ceremony)

1. **Collect friction.** From the wave just closed: WPs that bounced back underspecified,
   review findings that repeat across PRs, gates that false-alarmed or stayed silent,
   provider behaviors that surprised (good or bad), anything the operator had to say twice.
2. **Classify each item** by what should have prevented it:
   - a WP defect → improve `templates/work-package.md` or the spec template
   - a repeated review finding → add it to the relevant persona's checklist or footer
   - an entry-point ambiguity → fix `AGENTS.md` + shims (same PR, doctrine 5)
   - a provider surprise → update that `adapters/<provider>.md` (bump last-verified)
   - a paid-for failure with a general lesson → propose a doctrine amendment
   - operator preference, project-specific → route to layers 1–2, NOT the kit
3. **Write the smallest edit that prevents recurrence.** One lesson = one focused change.
   Resist growing documents; prefer sharpening existing lines (context is a budget).
4. **Ship as a PR** (in the right layer's repo) titled for the lesson, citing the incident
   (PR number / wave) as evidence. The maintainer merges — learning is gated like code.
5. **Prune quarterly.** Memory that no longer earns its context cost is deleted; rules whose
   failure can no longer occur (vendor gone, stack changed) are retired with a note.

## Memory for agents (the file pattern)

Persistent agent memory is **files in the repo layer that owns them**: an indexed directory
of small single-fact documents (one fact per file, an index file loaded each session,
frontmatter with a one-line description for recall). Harness-native mechanisms (e.g. Claude
Code auto-memory, Hermes-style skill libraries) may back it, but the portable, provider-
agnostic substrate is markdown in git — reviewable, diffable, prunable.

## Done when (per loop)

- Every friction item from the wave is either a merged/open PR in its correct layer or
  explicitly discarded with a reason.
- No lesson lives only in a chat (doctrine 6).
- The kit gained ONLY anonymized, project-independent text.
