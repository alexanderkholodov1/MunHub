# Work package template

> The work package (WP) is the fleet's unit of delegation (doctrine rule 4). A WP is **complete**
> when a mid-tier model, given ONLY this document and the files it lists, can deliver the PR
> without asking questions. If it can't, the WP is underspecified — fix the WP, not the model.
> Keep the whole WP under ~60 lines; if it won't fit, split it.

---

```markdown
## WP-NN — <imperative title, e.g. "Translate planning/ to English">

**Goal (1–2 sentences).** What exists after this WP that didn't before, and why it matters.

**Context (only what's needed).**
- Files to read: <exhaustive list — the worker reads nothing else>
- Files to touch: <exhaustive list — touching anything else is out of lane>
- Project rules that bind this WP: <link the 2–4 relevant guardrails, not the whole contract>

**Constraints.**
- <hard limits: APIs not to call, layers not to cross, decisions not to revisit>
- <what must NOT change (golden behavior, public contracts, numbers owned by another WP)>

**Steps (suggested, not binding).** 1. … 2. … 3. …

**Acceptance criteria (mechanical where possible).**
- [ ] <command or grep that must pass/return empty, e.g. `pnpm test` green>
- [ ] <observable behavior or artifact>
- [ ] Docs updated per the documentation matrix; changelog fragment added.

**Out of scope.** <the adjacent work a worker might be tempted to do — name it to forbid it>

**Delivery.** Branch `<prefix>/NN-slug` → commit(s) → push → PR titled per CONTRIBUTING with
the Stage Report: what was delivered, AC checklist state, risks/doubts, anything discovered
that should become a new WP (proposed, not executed).

**Routing.** <executor tier + provider, e.g. "mid-tier (Sonnet) / any cloud surface">
**Dependencies.** <WPs or PRs that must merge first; "none" is a valid answer>
```

---

## Authoring rules

1. **Context economy:** list files explicitly; never say "see the docs". Workers get the WP,
   not the project's whole reading list.
2. **Mechanical acceptance:** prefer a command, a grep, a CI gate. "Looks good" is not a
   criterion; it's a review note.
3. **Name the temptation:** the "Out of scope" line prevents the classic agent failure of
   helpfully refactoring the neighborhood.
4. **One PR per WP.** If a WP needs two PRs, it is two WPs.
5. **Discovered work goes to the Stage Report** as proposed WPs; the orchestrator triages —
   workers never self-assign follow-ups.
