# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Deploy hosting and database rules
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only database security rules
firebase deploy --only database

# Start local Firebase emulator (if needed)
firebase emulators:start

# Python serial bridge (for non-Chromium browsers)
python public/tools/serial_bridge.py
```

There is no build step, bundler, or test suite. The frontend is served directly as static files from `public/`.

## Architecture

MunHub is a real-time cosmic ray muon detector monitoring platform. It uses vanilla JavaScript (ES6+) with no frontend build toolchain — all JS is loaded via `<script>` tags in `public/index.html`. Firebase Realtime Database and Firebase Hosting are the only backend services.

### Module System

All modules are IIFEs that expose frozen APIs on the global scope. **Load order in `index.html` is the dependency graph** — there are no `import`/`require` statements.

Order and responsibilities:
1. `config.js` — frozen constants (Firebase config, colors, chart types, field labels, performance limits)
2. `ui-manager.js` — theme toggling, toast notifications, modal lifecycle
3. `firebase-manager.js` — singleton Firebase app; supports runtime database URL switching
4. `data-manager.js` — data state, Firebase subscriptions, LTTB downsampling (max 500 chart points), realtime cleanup
5. `chart-manager.js` — Chart.js rendering, time ranges, chart slot configuration, 1000ms throttle
6. `profile-manager.js` — profile CRUD, sharing/visibility, profile tree UI
7. `session-manager.js` — session lifecycle, file upload with deduplication, CSV download
8. `upload-manager.js` — file import/export utilities, ZIP backup/restore
9. `db-admin.js` — admin-only: storage stats, user management, role assignment
10. `auth.js` — Firebase Auth, role-based feature gating, English/Spanish i18n
11. `serial-reader.js` — Web Serial API (Chrome/Edge) + WebSocket bridge fallback (Firefox/Safari)
12. `app-entry.js` — orchestrator: wires modules, registers DOM listeners, restores localStorage prefs

### Data Flow

```
[USB Detector] → serial-reader.js → Firebase Realtime DB
                                           ↓ (child_added/changed/removed)
                                     data-manager.js  (LTTB downsampling)
                                           ↓ (change notifications)
                                     chart-manager.js (4-slot 2×2 grid)
```

`data-manager.js` uses `child_added/changed/removed` listeners (not `value`) to avoid re-downloading entire sessions on each minute save — a v5.0 change. Reverting to `once('value')` patterns will cause bandwidth regressions.

### Database Schema

```
/users/{uid}               — role (admin|user|guest), displayName, email
/profiles/{profileId}
  ├─ sessions/{sid}/minutes/{ts}   — per-minute averages (indefinite retention)
  ├─ realtime/{ts}                 — per-event records (8-minute sliding window)
  └─ latest                        — most recent data point
/organizations/{orgId}     — name, owner, members
```

Minute record fields: `ec` (events/min), `cc` (coincidences/min), `sm`/`sx`/`sn` (SiPM mV avg/max/min), `tp` (°C), `pr` (Pa), `d` (dead time %). All values are **averages, never sums** — scientific data integrity requirement, not a preference.

### Security Model

- Roles are read from `/users/{uid}/role` in the database, never hardcoded. The first admin must be set manually in Firebase Console.
- `database.rules.json` enforces: public profiles readable by anyone; private profiles only by owner, shared users, or admins; users can only read/write their own account.

### Serial Data Formats

`serial-reader.js` auto-detects four incoming formats from the USB detector:
- **CosmicWatch** — space-separated: `<ardu_time> <event> <adc> <SiPM_mV> <temp> <deadtime> [<sipm2>]`
- **JSON** — `{"ec":1,"sm":450,...}`
- **Key-Value** — `ec=1,sm=450,...`
- **CSV** — header row on first line, values on subsequent lines

### Non-Obvious Constraints

- **Realtime auto-expiry:** If realtime data is >8 min old, the 1m/5m time-range buttons disable and the view silently falls back to 15m. This is intentional — no user notification. The realtime node is capped at 5000 records (`REALTIME_LIMIT` in `config.js`).
- **Chart gap detection:** A gap of ≥2 minutes between consecutive data points breaks the chart line (`GAP_THRESHOLD` in `config.js`). Don't lower this — minute-boundary saves can arrive slightly late.
- **Serial browser support:** Web Serial API requires Chrome/Edge/Opera. Firefox/Safari users must run `serial_bridge.py` locally (listens on `ws://localhost:8765`).
- **localStorage for prefs:** Theme, time range, chart slot sources are persisted per-browser only. No cross-device sync.
- **Admin panel:** `db-admin.js` features render only when `auth.js` detects `role === 'admin'` from the database.
- **Cache-busting:** All JS/CSS `<script>`/`<link>` tags in `index.html` use `?v=5.0` query strings. Bump these when deploying breaking changes.
- **CSS variables:** Light/dark theme is handled entirely via CSS variable swapping in `ui-manager.js` — no class toggling on `<body>`.
- **`/terminal.html`:** A separate HTML page (not part of the SPA rewrite) used for diagnostics. It has its own script tags and is deployed alongside `index.html`.
