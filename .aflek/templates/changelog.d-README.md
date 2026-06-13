# Changelog fragments   *(AFLEK template — install as `changelog.d/README.md`)*

<!-- No placeholders. Add a `.gitkeep` next to this file so the directory survives empty. -->

To let many pull requests run in parallel without colliding on a single `CHANGELOG.md`, **each PR
drops a small fragment file here** instead of editing `CHANGELOG.md` directly. Fragments are
compiled into `CHANGELOG.md` under the next version at release time, then removed.

## Format
One file per change, named:

```
<slug>.<category>.md
```

- **`<slug>`** — short, unique, kebab-case (use the branch/spec slug, e.g. `auth-roles`).
  Unique filenames mean two PRs never touch the same file → no merge conflicts.
- **`<category>`** — one of: `added`, `changed`, `fixed`, `removed`, `deprecated`, `security`
  (the [Keep a Changelog](https://keepachangelog.com/) categories).

The file contains one or more bullet lines describing **what the change delivers**, written to
the `CONTRIBUTING.md` PR-description standard (neutral, product-facing — not a narrative of how
it was made).

## Example
`changelog.d/auth-roles.added.md`:
```md
- Role-based access control on the admin surface, with deny-by-default rules and tests.
```

## Release
At release, the maintainer (or orchestrator) collates all fragments into a new `CHANGELOG.md`
version section and deletes them. `.gitkeep` keeps this directory present when empty.
