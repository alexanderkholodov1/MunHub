- AFLEK auto-sync adoption: a generated `.aflek/` snapshot of the kit doctrine (playbooks,
  adapters, templates, tools, personas) now travels with the repo so cloud executors read current
  doctrine without a local kit clone; `aflek-sync` keeps it current and a `SessionStart` hook
  reports drift automatically. Vercel added to the fleet env loader (the roster is now
  Gemini · Cursor · GitHub · Vercel · Claude subagents · Copilot-review).
