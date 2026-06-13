# Playbook — how AFLEK runs, and how it stays in sync

> This answers two questions: **from which files does AFLEK actually execute**, and **how do kit
> changes reach every project without hand-editing N repos.** Read it once; it removes the "black
> box."

## 1. The three layers (and where each lives)

```
┌─ GitHub: alexanderkholodov1/AFLEK ────────── the KIT — single source of truth (public)
│     doctrine, playbooks, adapters, templates, personas, tools/aflek-sync.ps1
│
├─ GitHub: alexanderkholodov1/adjutant-AFLEK ─ the OVERLAY — personal, private (per-operator)
│     ADJUTANT.md (role), OPERATOR-PROFILE.md, memory/, journal/  — NO duplicated doctrine
│
└─ Each PROJECT (MunHub, …) ───────────────── the ADOPTER
      AGENTS.md (project-owned contract) · shims · .claude/agents (personas) ·
      infra/fleet (gates) · .aflek/ (generated read-only snapshot of the kit) · FLEET-VERSION
```

**Source of truth = the kit.** The overlay adds *who the Adjutant is* (role, profile, memory) and
**consumes** the kit — it must not keep its own copies of playbooks (that is the drift bug fixed
here). A project never invents doctrine; it carries a **generated `.aflek/` snapshot** of the kit
plus the harness-live files its tools load.

## 2. From which files AFLEK executes (the run path)

1. **Session start.** The machine-level pointer (`~/.claude/CLAUDE.md`) tells Claude Code to read
   the overlay's `CLAUDE.md` → `ADJUTANT.md` (role) + `OPERATOR-PROFILE.md` + `memory/MEMORY.md`.
   That is *who* is running.
2. **Project contract.** In the repo, `AGENTS.md` is the binding contract every agent reads first;
   the shims (`GEMINI.md`, `.cursor/rules/00-agents.mdc`, `.github/copilot-instructions.md`,
   `CLAUDE.md`) point any provider to it.
3. **Doctrine.** When the orchestrator runs a milestone it reads the playbooks from the project's
   **`.aflek/playbooks/`** (compose-fleet → run-a-wave), adapters from `.aflek/adapters/`, and
   uses `.aflek/tools/` (fleet-status, aflek-sync, wave-preflight). Because `.aflek/` is synced,
   this is always current — no absolute path to the kit clone required.
4. **Execution.** Gates run from `infra/fleet/` (preflight) and `.aflek/tools/` (status); workers
   are dispatched per the adapters; secrets load via `infra/fleet/load-fleet-env.sh`.

## 3. How sync works (the autonomy)

`tools/aflek-sync.ps1` is the mechanism:

- **Pull** the kit clone from GitHub (source of truth refreshes locally).
- **Materialise** `.aflek/` in the project (playbooks, adapters, doctrine, templates, tools) — a
  read-only snapshot the orchestrator reads. **Never hand-edit `.aflek/`; edit the kit, re-sync.**
- **Refresh** harness-live copies (reviewer personas → `.claude/agents`).
- **Bump** the project's `FLEET-VERSION` to the kit's.
- **Report** the diff. `-Check` reports drift and changes nothing (exit 1 if behind).

One project: `pwsh .aflek/tools/aflek-sync.ps1 -Project .`. Four projects: the same command in
each — or the hook below makes it zero-touch.

## 4. Zero-touch: the SessionStart hook

Add to each adopter's `.claude/settings.json` (or user-level settings) so every session checks
drift automatically — no one has to remember:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command",
        "command": "pwsh -NoProfile -File .aflek/tools/aflek-sync.ps1 -Project . -Check" } ] }
    ]
  }
}
```

`-Check` is non-mutating: it prints "DRIFT: N items behind the kit" when the kit moved, and the
orchestrator runs the full sync (one command) as the first act of the session. Prefer `-Check` in
the hook over a full auto-sync so the working tree never changes silently on open; the full sync
is a deliberate, reviewable commit.

**One-time per machine:** the hook runs the `.aflek/` *copy* of the script, so it needs a pointer
to the real kit clone. Set it once (like the kit clone itself):

```powershell
[Environment]::SetEnvironmentVariable("AFLEK_KIT", "C:\My Files\fleet", "User")
```

Every project on the machine then syncs against that one kit clone. Without it, the script stops
with a clear error instead of silently comparing the snapshot to itself.

## 5. Updating doctrine (the loop)

1. Edit the **kit** (never a project's `.aflek/`, never the overlay's old copies).
2. PR + merge in the kit; bump `FLEET-VERSION` if it's a release (`upgrade-kit-version.md`).
3. Each project's next session reports drift; `aflek-sync` materialises it; commit the `.aflek/`
   update as one chore. Four projects, four one-line syncs — or four hooks, zero touches.

> The overlay is itself an adopter: it carries `.aflek/` like any project and adds the personal
> layer on top. No more duplicated playbooks anywhere.
