- AFLEK auto-sync adoption: a generated `.aflek/` snapshot of the kit doctrine (playbooks,
  adapters, templates, tools, personas) now travels with the repo so cloud executors read current
  doctrine without a local kit clone; `aflek-sync` keeps it current and a `SessionStart` hook
  reports drift automatically. Vercel added to the fleet env loader (the roster is now
  Gemini · Cursor · GitHub · Vercel · Claude subagents · Copilot-review).
- The repo is now driven by the one-word **"empieza"** flow (`.aflek/playbooks/start.md`, wired
  from `CLAUDE.md`): selftest → self-update → orient → compose fleet → propose → execute+monitor →
  self-review → one PR → self-improve. The fan-out gate is the kit's generalised
  `.aflek/tools/wave-preflight.ps1` (the project-local copy is removed).
