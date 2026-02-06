# MuNRa 3.2 - Cosmic Ray Monitor

<div align="center">
  <img src="https://img.shields.io/badge/version-3.2.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/python-3.8+-green" alt="Python">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License">
</div>

## 📖 Overview

MuNRa (Muon Nuclei Ray) is a cosmic ray monitoring system designed to read data from particle detectors via serial port, process measurements in real-time, and upload them to Firebase for cloud storage and web visualization.

### Features

- 🔌 **Serial Communication** - Reads detector data via USB serial port
- 📊 **Real-time Processing** - Aggregates per-minute statistics (events, coincidences, SiPM voltage)
- ☁️ **Cloud Sync** - Uploads data to Firebase Realtime Database
- 🌐 **Web Dashboard** - Real-time visualization with interactive charts
- 👥 **Multi-user Support** - Profile management with permissions system
- 🔐 **Authentication** - Firebase Auth integration for secure access

## 🚀 Quick Start

### Installation

```bash
# Clone or download
git clone https://github.com/your-username/MuNRa-3.2.git
cd MuNRa-3.2

# Run installer (creates venv, installs dependencies)
./install.sh

# Start MuNRa
./run.sh
```

### Manual Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install pyserial firebase-admin

# Run
python munra.py
```

## 📁 Project Structure

```
MuNRa-3.2/
├── munra.py              # Main entry point
├── run.sh                # Quick start script
├── install.sh            # Dependency installer
├── uninstall.sh          # Cleanup script
├── README.md             # Documentation
├── .gitignore            # Git ignore rules
│
├── config/               # Configuration files
│   └── firebase_credentials.json  # Firebase service account (not in repo)
│
├── data/                 # Local data storage
│   └── sessions/         # Profile session data
│
└── src/
    ├── core/             # Business logic modules
    │   ├── __init__.py
    │   ├── config.py     # Configuration management
    │   ├── firebase.py   # Firebase integration
    │   ├── serial.py     # Serial port & data parsing
    │   ├── profiles.py   # Profile/session management
    │   ├── acquisition.py # Data acquisition controller
    │   └── webserver.py  # Local API server
    │
    ├── cli/              # Command-line interface
    │   ├── __init__.py
    │   ├── main.py       # CLI entry point
    │   └── menus.py      # Interactive menus
    │
    └── web/              # Web dashboard
        ├── index.html    # Main HTML page
        ├── css/
        │   └── main.css  # Styles
        └── js/
            ├── app.js    # Main application
            └── auth.js   # Authentication
```

## ⚙️ Configuration

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Realtime Database** and **Authentication**
3. Generate a service account key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `config/firebase_credentials.json`

4. Configure Firebase URL in the application or set it in the menu.

### Serial Port

Connect your cosmic ray detector via USB. The application will auto-detect available ports.

Default settings:
- Baud rate: 9600
- Data format: JSON lines

## 🎮 Usage

### Interactive Menu

```bash
./run.sh
```

Main menu options:
1. **Start Acquisition** - Begin reading data from detector
2. **Manage Profiles** - Create, view, and manage profiles
3. **View Data** - Browse stored measurements
4. **Settings** - Configure Firebase, serial port, etc.
5. **Web Authentication** - Link web sessions
6. **Exit** - Quit application

### Command Line Arguments

```bash
python munra.py --read              # Start acquisition immediately
python munra.py --profile MyStation # Use specific profile
python munra.py --port /dev/ttyUSB0 # Specify serial port
python munra.py --web               # Start web server mode
```

### Web Dashboard

Access the web dashboard:
1. Upload the `src/web/` folder to a web server, or
2. Open `src/web/index.html` directly in a browser
3. Configure the Firebase URL in Settings
4. Select your profile to view data

## 📊 Data Format

### Serial Input (from detector)

```json
{"ev": 125, "cc": 23, "sipm_avg": 48.5, "sipm_max": 102.3, "sipm_min": 12.1, "temp": 24.5, "pressure": 101325}
```

### Stored Data (per minute)

```json
{
  "timestamp": 1704067200,
  "datetime": "2024-01-01T00:00:00-05:00",
  "ec": 7500,          // Events count
  "cc": 1380,          // Coincidences count
  "sm": 48.5,          // SiPM average (mV)
  "sx": 102.3,         // SiPM max (mV)
  "sn": 12.1,          // SiPM min (mV)
  "tp": 24.5,          // Temperature (°C)
  "pr": 101325,        // Pressure (Pa)
  "dt": 0.0            // Dead time (%)
}
```

## 🔐 Authentication

### Web Authentication

Users can create accounts on the web dashboard and link them to the CLI application for profile ownership and permissions.

**Linking Process:**
1. Log in on the web dashboard
2. Go to Settings → Link CMD Session
3. Copy the authentication token
4. In the CLI, select "Web Authentication" → "Link manually"
5. Paste the token

### Roles

- **Admin** - Full access to all profiles and settings
- **User** - Can create profiles and share with others
- **Guest** - View public profiles only

## 🛠️ Development

### Adding New Features

1. Core logic goes in `src/core/`
2. Menu items go in `src/cli/menus.py`
3. Web functionality in `src/web/js/`

### Testing

```bash
# Activate venv
source venv/bin/activate

# Run with debug output
python munra.py --debug
```

## 📜 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Contact

For questions or support, open an issue on GitHub.

---

**MuNRa** - Monitoring cosmic rays, one particle at a time ✨
