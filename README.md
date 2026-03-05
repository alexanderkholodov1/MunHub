# MunHub 5.0 — Cosmic Ray Monitoring Platform

<div align="center">
  <img src="https://img.shields.io/badge/version-5.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/firebase-hosting-orange" alt="Firebase Hosting">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/language-EN%20%7C%20ES-lightgrey" alt="Languages">
</div>

---

**MunHub** (formerly MuNRa) is a web-based platform for monitoring cosmic ray muon detectors in real time. Researchers, universities, and enthusiasts worldwide can connect their particle detectors, collect data continuously, visualize multiple data streams, and collaborate through a shared cloud database.

**Live instance:** [https://munra-1.web.app](https://munra-1.web.app)

---

## Features

- **Browser-based serial reader** — Connect to a detector via USB directly from Chrome/Edge using the Web Serial API, or from any browser through the included Python WebSocket bridge.
- **Real-time charts** — Four configurable chart slots (Events, SiPM signal, Temperature & Pressure, Dead Time) with six chart types, Accurate/Stacked view modes, and 14 time-range presets including custom date ranges.
- **Per-minute data aggregation** — Incoming events are averaged every minute and stored indefinitely. Real-time per-event data is optionally stored for up to 5 minutes.
- **Multi-profile system** — Each detector is a profile. Profiles can be public or private, shared with specific users, and organized by ownership.
- **Session management** — Start/stop recording sessions, upload raw log files, download sessions as CSV, and detect duplicate data with merge resolution.
- **Authentication and roles** — Email/password accounts via Firebase Auth with admin, user, and guest roles. Role-based database security rules.
- **Admin panel** — Database size monitoring, storage quota visualization, database duplication/migration, and root URL switching.
- **Internationalization** — Full English and Spanish translations; switchable from the UI.
- **Dark and light themes** — Toggle with persistent preference.
- **Responsive design** — Works on desktop, tablet, and mobile screens.
- **CI/CD** — GitHub Actions workflow deploys to Firebase Hosting on every push to main.

---

## Project Structure

```
MunHub-5.0/
├── .github/workflows/firebase-deploy.yml   # CI/CD: auto-deploy on push
├── public/
│   ├── index.html                # Main dashboard
│   ├── terminal.html             # Standalone data terminal
│   ├── favicon.svg               # Tab icon
│   ├── css/main.css              # All styles (dark/light themes, responsive)
│   ├── js/
│   │   ├── config.js             # Central configuration constants
│   │   ├── firebase-manager.js   # Firebase SDK initialization
│   │   ├── auth.js               # Authentication, user management, i18n
│   │   ├── data-manager.js       # Firebase data subscriptions, LTTB downsampling
│   │   ├── chart-manager.js      # Chart.js rendering, chart types, overlays
│   │   ├── serial-reader.js      # Web Serial API + WebSocket bridge
│   │   ├── profile-manager.js    # Profile CRUD, sharing, visibility
│   │   ├── session-manager.js    # Session CRUD, upload/download
│   │   ├── upload-manager.js     # File upload/export
│   │   ├── db-admin.js           # Admin panel (storage stats, migration)
│   │   ├── ui-manager.js         # Theme toggle, toasts, modals
│   │   └── app-entry.js          # Application orchestrator
│   └── tools/serial_bridge.py    # Python WebSocket bridge for non-Chromium browsers
├── database.rules.json           # Firebase security rules
├── firebase.json                 # Firebase hosting configuration
├── .firebaserc                   # Firebase project alias
├── .gitignore                    # Excludes credentials, caches, local data
└── README.md
```

---

## Quick Start

### 1. View Data (no installation required)

Open the hosted dashboard in any modern browser:

> [https://munra-1.web.app](https://munra-1.web.app)

Public profiles are visible without an account. Create an account to manage your own profiles.

### 2. Connect a Detector

#### Option A — Web Serial API (Chrome, Edge, Opera)

1. Open the dashboard and sign in.
2. Click the serial terminal icon in the top bar.
3. Select your profile and click **Connect**.
4. Choose your serial port from the browser prompt.
5. Click **Start Recording**.

#### Option B — WebSocket Bridge (Firefox, Safari, any browser)

1. Install the bridge dependencies:

   ```bash
   pip install pyserial websockets
   ```

2. Start the bridge:

   ```bash
   python public/tools/serial_bridge.py
   ```

   The bridge auto-detects the detector, opens the serial port at 9600 baud, and starts a WebSocket server on `ws://localhost:8765`.

3. Open the dashboard in your browser. The serial reader will automatically detect and use the bridge.

### 3. Deploy Your Own Instance

If you want to host the dashboard under your own Firebase project:

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Realtime Database** and **Authentication** (Email/Password).
3. Update the `FIREBASE_CONFIG` object in `public/js/config.js` with your project credentials.
4. Install the Firebase CLI:

   ```bash
   npm install -g firebase-tools
   firebase login
   ```

5. Deploy:

   ```bash
   firebase deploy
   ```

6. Set your first admin: in the Firebase Console, navigate to Realtime Database and set `/users/<your-uid>/role` to `"admin"`.

---

## Data Architecture

### Minute Records (stored indefinitely)

Every minute, incoming events are aggregated into a single record:

| Field | Description | Unit |
|-------|-------------|------|
| `ts` | Unix timestamp | ms |
| `dt` | ISO 8601 datetime | — |
| `ec` | Event count | events/min |
| `cc` | Coincidence (muon) count | muons/min |
| `sm` | SiPM signal average | mV |
| `sx` | SiPM signal max | mV |
| `sn` | SiPM signal min | mV |
| `tp` | Temperature average | C |
| `pr` | Pressure average | Pa |
| `d` | Dead time average | % |

All values are **averages** (not sums) computed from every event received within that minute.

### Real-Time Records (5-minute retention)

When the user enables real-time recording, individual events are stored temporarily. Records older than 5 minutes are automatically deleted. These power the 1m and 5m chart views.

### Database Path Layout

```
/users/{uid}                                        # User account and role
/profiles/{profileId}/                              # Profile metadata
/profiles/{profileId}/sessions/{sid}                # Session metadata
/profiles/{profileId}/sessions/{sid}/minutes/{ts}   # Minute records
/profiles/{profileId}/realtime/{ts}                 # Real-time event records
/profiles/{profileId}/latest                        # Most recent data point
/organizations/{orgId}                              # Organization metadata
```

### Security Rules

The `database.rules.json` enforces:

- Users can only read/write their own account data.
- Public profiles are readable by anyone; private profiles require ownership, shared access, or admin role.
- Write access requires ownership, shared edit permission, or admin role.
- Admin role is set manually in the Firebase Console (never hardcoded).

---

## Chart System

### Time Ranges

| Range | Data Source | Notes |
|-------|------------|-------|
| 1m, 5m | Real-time events | Only available when real-time data exists |
| 15m - 30d | Minute records | Always available |
| Custom | Minute records | Date range picker |

### View Modes

- **Accurate** — X-axis shows real timestamps; gaps between sessions are visible.
- **Stacked** — Sessions are concatenated into a continuous curve; X-axis adapts to available data.

### Chart Types

Line + Dots, Line Only, Smooth + Dots, Smooth Curve, Bar Chart, Scatter. Each chart slot stores its type preference in localStorage.

### Performance

Charts are capped at 500 points using the LTTB (Largest-Triangle-Three-Buckets) downsampling algorithm to prevent browser lag with large datasets.

---

## Serial Data Formats

The serial reader supports multiple detector output formats:

| Format | Example |
|--------|---------|
| CosmicWatch (tab-separated) | `125 1704067200 245 102 48.5 101325 24.5 0.14 0 1` |
| JSON | `{"ev": 125, "cc": 23, "sipm_avg": 48.5, ...}` |
| Key-Value | `TRG 1 CH 1 ADC 245 TEMP 22.5 PRES 101320` |
| CSV | `125,1704067200,245,102,48.5,101325,24.5,0.14,0,1` |

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Charts | Chart.js 4.4.1 + chartjs-adapter-date-fns 3.0.0 |
| Backend | Firebase Realtime Database, Firebase Auth |
| Hosting | Firebase Hosting |
| Serial (Chromium) | Web Serial API |
| Serial (other browsers) | Python WebSocket bridge (pyserial, websockets) |
| CI/CD | GitHub Actions |

No build tools, no bundlers, no npm dependencies for the frontend. The entire application loads from plain script tags.

---

## Browser Compatibility

| Browser | Serial Connection | Dashboard |
|---------|------------------|-----------|
| Chrome / Edge / Opera | Web Serial API (native) | Full support |
| Firefox | WebSocket bridge (Python) | Full support |
| Safari | WebSocket bridge (Python) | Full support |
| Mobile browsers | View only | Full support |

---

## Development

### File Organization

Each JavaScript module is a self-contained IIFE (Immediately Invoked Function Expression) that exposes a frozen public API. Modules communicate through the global scope with a defined load order in index.html.

### Adding a Feature

1. If it involves data logic, modify or extend the relevant module in `public/js/`.
2. If it needs UI, add the HTML in `public/index.html` and styles in `public/css/main.css`.
3. For new server-side logic, consider Firebase Cloud Functions.

### Deployment

Push to `main` to trigger automatic deployment via GitHub Actions. For manual deployment:

```bash
firebase deploy --only hosting
firebase deploy --only database  # to update security rules
```

### Conventions

- All variables, comments, and function names in English.
- Commit messages follow the pattern: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- No hardcoded credentials or admin UIDs in source code.
- Data is never filtered or discarded — scientific integrity is non-negotiable.

---

## Version History

| Version | Description |
|---------|-------------|
| 1.0 | Python desktop application with local SQLite database |
| 2.0 | Migration to web platform with Firebase |
| 3.0 - 3.2 | Role-based access, session management, admin panel |
| 4.0 - 4.8 | Web Serial API, security hardening, modular JS architecture, i18n, LTTB downsampling, profile sharing, Accurate/Stacked modes, custom time ranges |
| **5.0** | **Full rewrite as MunHub. Bandwidth-optimized Firebase subscriptions, WebSocket bridge for non-Chromium browsers, standalone data terminal, session upload with duplicate detection, database migration tools, organization support, six chart types with color customization** |

---

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Submit a pull request.

Pull requests that touch data processing must verify that aggregation uses **averages** (not sums) and that no data is silently discarded.

---

## License

MIT License. See LICENSE file for details.

---

## External Resources

- [MuNRa Detector Documentation](https://gitmilab.redclara.net/muografia/escaramujo/munra_como_usar/-/tree/main?ref_type=heads)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Web Serial API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
