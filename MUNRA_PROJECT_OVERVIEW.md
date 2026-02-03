# MuNRa 4.0 - Complete Project Documentation for AI Assistants

## Table of Contents
1. [Project Vision & Purpose](#project-vision--purpose)
2. [Core Principles & Objectives](#core-principles--objectives)
3. [Technical Architecture](#technical-architecture)
4. [Critical Implementation Rules](#critical-implementation-rules)
5. [Current Status & Known Issues](#current-status--known-issues)
6. [Pending Features & Future Development](#pending-features--future-development)
7. [Database Structure & Data Management](#database-structure--data-management)
8. [User Interface Requirements](#user-interface-requirements)
9. [Testing & Quality Assurance](#testing--quality-assurance)

---

## Project Vision & Purpose

### What is MuNRa?
MuNRa is a **web-based particle detector data visualization platform** designed for the scientific community. It allows researchers, universities, and enthusiasts worldwide to:
- Monitor cosmic ray muon detectors in real-time
- Collect and analyze particle detection data continuously (24/7)
- Collaborate globally by sharing detector profiles and data
- Visualize multiple data streams simultaneously from detectors around the world

### Primary Use Case
The system is designed to run **continuously in laboratory environments** where:
- Data is displayed on large screens visible to the public
- The terminal shows real-time data acquisition
- Multiple time scales (1 minute to 30 days) can be visualized
- Professional researchers and students can access data remotely

### Long-term Vision
- **Global collaboration**: Hundreds of detectors worldwide contributing to one unified database
- **Open-source**: Easy to clone, modify, and contribute to via GitHub
- **Accessible**: Usable by non-programmers with minimal setup
- **Scalable**: Support simultaneous data from dozens/hundreds of detectors
- **Multi-language**: Initially English with Spanish support, expandable

---

## Core Principles & Objectives

### 1. **Optimization Above All**
- **Minimal dependencies**: Avoid unnecessary libraries
- **Lightweight**: The entire application should be as small as possible
- **Memory efficient**: Aggressive cleanup of old real-time data
- **Database optimization**: Only store what's necessary in the most efficient format
- **Performance**: Must run 24/7 without degradation

### 2. **Code Quality & Maintainability**
- **Modular architecture**: Separate files for distinct functionalities
- **No monolithic files**: Functions organized in logical modules
- **Clean code**: Remove deprecated, unused, or garbage code
- **Well-documented**: Comprehensive documentation for all processes
- **Open-source standards**: Easy to fork, branch, and contribute via GitHub

### 3. **Data Integrity & Accuracy**
- **Averages, not sums**: Critical - data aggregation must calculate averages per minute
- **Precise timestamps**: All data must have accurate GMT-5 timestamps
- **Validation**: Input data must be validated before storage
- **No data loss**: Minute-by-minute records stored indefinitely
- **Real-time cleanup**: Automatic deletion of real-time data older than 5 minutes

### 4. **User Experience**
- **Intuitive**: Minimal actions required to start recording data
- **Responsive**: Works on mobile, tablet, and desktop screens
- **Readable**: Large text and numbers visible from a distance
- **Professional**: Scientific aesthetics, not AI-generated generic design
- **Clear error handling**: Detailed, actionable error messages

### 5. **Security & Access Control**
- **Role-based permissions**: Admin, Editor, Viewer roles
- **Profile ownership**: Users control their detector profiles
- **Organization support**: Shared profiles within organizations
- **Database roles**: Read from user database, never hardcode UIDs

### 6. **Scalability**
- **Multi-profile support**: Unlimited detector profiles
- **Multi-session management**: Track multiple recording sessions per profile
- **Global deployment**: Firebase hosting for worldwide access
- **Concurrent users**: Support many users viewing/recording simultaneously

---

## Technical Architecture

### Platform
- **Frontend**: Web-based (HTML/CSS/JavaScript)
- **Backend**: Firebase (Authentication, Realtime Database, Hosting)
- **Deployment**: Firebase Hosting (HTTPS required for Web Serial API)
- **Browser Support**: Chrome, Edge (Web Serial API requirement)

### File Structure
```
munra-4.0/
├── public/
│   ├── index.html              # Main application page
│   ├── css/
│   │   └── main.css            # All styling
│   └── js/
│       ├── auth.js             # Firebase auth & user management
│       ├── serial-reader.js    # Web Serial API for detector (NEW!)
│       └── app.js              # Main orchestration & charts
├── firebase.json               # Firebase hosting config
├── database.rules.json         # Firebase security rules (UPDATED!)
├── .firebaserc                 # Firebase project config
├── .gitignore                  # Excludes credentials (NEW!)
├── .github/
│   └── workflows/
│       └── firebase-deploy.yml # CI/CD pipeline (NEW!)
├── FIREBASE_DEPLOYMENT.md      # Deployment instructions (NEW!)
└── MUNRA_PROJECT_OVERVIEW.md   # This documentation
```

### Technology Stack
- **Web Serial API**: Direct connection to detector via USB
- **Firebase Auth**: User authentication system
- **Firebase Realtime Database**: NoSQL data storage
- **Chart.js**: Data visualization library
- **Vanilla JavaScript**: No heavy frameworks (lightweight)

---

## Critical Implementation Rules

### ⚠️ RULE 1: Data Must Be Averaged, NOT Summed
**THE BIGGEST BUG IN PREVIOUS VERSIONS**

When aggregating events per minute, calculate **averages**:

```javascript
// CORRECT:
const sipm_avg = sipmSum / eventCount;
const temp_avg = tempSum / eventCount;
const pressure_avg = pressureSum / eventCount;

// WRONG (creates values like 28,000,000 mV):
const sipm_avg = sipmSum;  // ❌ NEVER DO THIS
```

This applies to all aggregated data fields.

### ⚠️ RULE 2: Never Hardcode Admin UIDs
```javascript
// WRONG:
if (uid === 'abc123xyz') return 'admin';  // ❌

// CORRECT:
const snapshot = await get(ref(db, `users/${uid}/role`));
return snapshot.val() || 'viewer';  // ✅
```

Always read roles from the database.

### ⚠️ RULE 3: Real-time Data Auto-Deletion
Real-time data is **expensive** and must be deleted:

```javascript
// Continuously check and delete data older than 5 minutes
// This must run automatically, even if no detector is active
// Maximum storage: 5 minutes of real-time data
```

Current issue: Previous versions stored **2 million records (32 MB)** that never got deleted!

### ⚠️ RULE 4: Console Output Format
```javascript
// CORRECT: Use newlines
console.log("Event 1\nEvent 2\nEvent 3");

// WRONG: Use carriage returns
console.log("Event 1\rEvent 2\rEvent 3");  // ❌
```

Terminal output must use `\n` for proper display.

### ⚠️ RULE 5: Input Validation
All incoming data must be validated:

```javascript
const VALIDATION = {
    sipm: { min: 0, max: 500 },           // mV
    temp: { min: -40, max: 85 },          // Celsius
    pressure: { min: 80000, max: 120000 } // Pa
};
```

Invalid data corrupts statistics must be notified on the main dashboard on the website.

### ⚠️ RULE 6: Web-Only Application
- **NO** local Python application
- **NO** install.sh scripts
- **NO** CLI tools
- Everything runs in the browser
- Web Serial API for detector connection

### ⚠️ RULE 7: Chart Time Ranges
Time range buttons (1m, 5m) are disabled unless:
1. User explicitly enabled real-time recording, AND
2. Real-time data exists in database

Check `hasRealtimeData()` before enabling these buttons.

---

## Current Status & Known Issues

### ✅ What Works
- Firebase Authentication (sign up, sign in, sign out)
- User role management (admin, editor, viewer)
- Profile creation and management
- Session recording and tracking
- Web Serial API detector connection
- Minute-by-minute data aggregation (with averages!)
- Real-time chart updates
- Multiple time range views (15m, 30m, 1h, 6h, 12h, 24h, 3d, 7d, 14d, 30d)
- CSV export functionality
- Theme toggle (dark/light mode)
- Admin panel for user management
- Public/private profile visibility
- Mobile responsive design

### ✅ Recently Fixed (February 2026)

#### 1. Security Hardening
**Status**: ✅ FIXED

**What was done**:
- Removed hardcoded `ADMIN_UID` from auth.js - roles now read from database only
- Implemented proper Firebase database security rules with role-based access control
- Added `.gitignore` to prevent committing sensitive files (firebase_credentials.json)
- Created `FIREBASE_DEPLOYMENT.md` with secure deployment instructions

**New Security Rules**:
- Public profiles: Anyone can read
- Private profiles: Only owner, shared users, and admins can read
- Write access: Only authenticated users with proper permissions
- Admin role: Must be set manually in Firebase Console

#### 2. Web Serial API Implementation
**Status**: ✅ IMPLEMENTED

**What was done**:
- Created `serial-reader.js` with full Web Serial API support
- Browser-based serial terminal with connect/disconnect/record controls
- Support for multiple data formats (key-value, CSV, JSON)
- Proper data validation with configured ranges
- Minute-by-minute averaging (CRITICAL: averages, not sums!)
- Real-time data with optional storage (expensive)

**UI Flow**:
1. User clicks serial terminal button (visible when logged in)
2. Modal shows connection controls and profile selector
3. User connects to serial port and starts recording
4. Data displayed in real-time terminal view
5. Data saved to Firebase with proper averaging

#### 3. Automatic Database Cleanup
**Status**: ✅ IMPLEMENTED

**What was done**:
- Added `startRealtimeDataCleanup()` function that runs every minute
- Automatically deletes real-time data older than 5 minutes
- Runs in background even without active detector connections
- Prevents database growth from accumulating old real-time records

#### 4. CI/CD Pipeline
**Status**: ✅ IMPLEMENTED

**What was done**:
- Created `.github/workflows/firebase-deploy.yml`
- Automatic deployment on push to main/master
- Preview deployments for pull requests
- Database rules deployment included

### ⚠️ Known Issues (May Need Verification)

#### 1. Real-time Data Not Displayed (1m and 5m views)
**Status**: Needs verification after deployment

**Current state**:
- Cleanup mechanism now implemented
- Data should display but needs testing with actual detector

#### 2. 5-Minute View Showing Too Many Points
**Status**: Needs verification

**Issue**: May still show too many points instead of minute averages
- Implementation exists but needs real-world testing

#### 3. Admin Panel Incomplete
**Status**: Partial - Basic functionality exists

**Missing features**:
- Database size display in UI
- Session editing (JSON modification)
- Individual minute record editing
- Database migration tools
- Error log viewer
- Real-time data cleanup status
- Memory usage warnings

---

## Pending Features & Future Development

### High Priority (Version 4.0)

#### 1. **Browser-Based Serial Reader**
**Status**: ✅ IMPLEMENTED (serial-reader.js)

Features implemented:
- Serial terminal modal with connect/disconnect controls
- Direct serial port connection via Web Serial API
- Real-time data display in terminal view
- Profile selector for data writing
- Optional real-time recording toggle
- Multiple data format parsing (key-value, CSV, JSON)
- Data validation before storage
- Minute-by-minute averaging

#### 2. **Enhanced Admin Panel**
Move ALL local app functionality to admin panel:
- Profile management (create, rename, delete)
- Session management (edit, delete, view JSON)
- Minute-level data editing
- Database configuration
- Database migration (copy to new Firebase instance)
- Real-time memory usage display
- Error and notification center
- Version information

#### 3. **Organization System**
- Create organizations
- Invite users to organizations
- Shared profile access within organizations
- Configurable default permissions (view/edit)
- Organization profile pictures
- Leave/join with confirmation

#### 4. **Enhanced Profile Features**
- Optional location field (city, building, room number)
- Detector identification (e.g., "Detector #3")
- Geographic coordinates for mapping
- Profile pictures
- Detailed descriptions

#### 5. **Accurate vs Stacked View Modes**
**Status**: ✅ IMPLEMENTED

Global toggle for all charts:

**ACCURATE mode**:
- X-axis shows exact timestamps
- Gaps between recording sessions visible
- Time range is fixed (e.g., exactly 24 hours)
- Multiple sessions appear as separate curves

**STACKED mode**:
- X-axis is variable (compresses to available data)
- No gaps - continuous curve
- Sessions concatenated seamlessly
- Adjusts if less data than requested range

#### 6. **Custom Time Range**
**Status**: ✅ IMPLEMENTED

Features:
- Date range picker modal
- Respects Accurate/Stacked modes
- Shows exact session boundaries (Accurate)
- Shows continuous data flow (Stacked)

#### 7. **Multi-Language Support**
**Status**: ✅ IMPLEMENTED (English and Spanish)

Features:
- English (default)
- Spanish
- Language selector in settings
- All UI text translated
- Professional scientific terminology

### Medium Priority (Version 4.1+)

#### 8. **Session Merge Functionality**
- Combine old sessions into single continuous records
- Configurable age threshold
- Reduce database fragmentation
- Preserve data integrity

#### 9. **Advanced Data Export**
- Export specific sessions
- Export entire profiles
- Import session files
- Git-style merge conflicts resolution

#### 10. **Enhanced Visualizations**
- Oscilloscope-style display integration
- Side-by-side detector comparison
- Global detector map
- Statistical analysis tools

#### 11. **Notification System**
- Email alerts for errors
- Data collection status updates
- Memory usage warnings
- Detector connection loss alerts

### Long-term Vision (Version 5.0+)

#### 12. **Global Collaboration Platform**
- Public detector registry
- Data sharing agreements
- Citation system for published data
- Collaborative research tools

#### 13. **Advanced Analytics**
- Machine learning anomaly detection
- Correlation analysis across detectors
- Weather correlation studies
- Solar activity correlation

#### 14. **Mobile Apps**
- Native iOS app
- Native Android app
- Push notifications
- Offline mode with sync

---

## Database Structure & Data Management

### Firebase Realtime Database Schema

```
/profiles/{profileId}
    ├── name: "Detector USFQ Basement H-212 #3"
    ├── description: "Cosmic ray muon detector"
    ├── location: "Quito, Ecuador - USFQ Basement H-212"
    ├── coordinates: { lat: -0.123, lng: -78.456 }
    ├── owner: "user_uid_here"
    ├── ownerEmail: "user@example.com"
    ├── isPublic: true
    ├── editors: ["uid1", "uid2"]
    ├── viewers: ["uid3", "uid4"]
    ├── created: 1704067200000
    └── updated: 1704153600000

/profiles/{profileId}/sessions/{sessionId}
    ├── name: "Session Jan 15 2025"
    ├── description: "24-hour continuous recording"
    ├── startTime: 1704067200000
    ├── endTime: 1704153600000
    └── minuteCount: 1440

/profiles/{profileId}/data/minutes/{minuteKey}
    ├── timestamp: 1704067260000
    ├── event_count: 450
    ├── muon_count: 23
    ├── sipm_avg: 145.5        # mV (AVERAGE!)
    ├── sipm_min: 120.0
    ├── sipm_max: 180.0
    ├── temp_avg: 22.5         # Celsius (AVERAGE!)
    ├── pressure_avg: 101325   # Pa (AVERAGE!)
    └── deadtime_avg: 0.15     # (AVERAGE!)

/profiles/{profileId}/data/realtime/{timestamp}
    ├── timestamp: 1704067261234
    ├── sipm: 148.5            # mV (individual event)
    ├── temp: 22.4
    ├── pressure: 101320
    ├── deadtime: 0.14
    ├── coincident: 0
    └── trg: 1

/users/{uid}
    ├── email: "user@example.com"
    ├── role: "viewer" | "editor" | "admin"
    ├── displayName: "John Doe"
    ├── organization: "USFQ Physics Lab"
    ├── photoURL: "https://..."
    └── created: 1704067200000

/organizations/{orgId}
    ├── name: "USFQ Physics Department"
    ├── owner: "user_uid_here"
    ├── members: ["uid1", "uid2", "uid3"]
    ├── photoURL: "https://..."
    ├── defaultPermission: "viewer" | "editor"
    └── created: 1704067200000
```

### Data Retention Policies

#### Minute-by-Minute Records
- **Storage**: Indefinite
- **Purpose**: Long-term scientific analysis
- **Location**: `/profiles/{profileId}/data/minutes/`
- **Size**: ~100 bytes per minute (~50 MB per year)

#### Real-time Records
- **Storage**: Maximum 5 minutes
- **Purpose**: Live visualization only
- **Location**: `/profiles/{profileId}/data/realtime/`
- **Cleanup**: Automatic deletion of records older than 5 minutes
- **Size**: Variable (depends on event rate, ~1-10 MB for 5 minutes)

#### Cleanup Implementation
```javascript
// Pseudo-code for cleanup loop
async function cleanupRealtimeData() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    for (const profile of allProfiles) {
        const realtimeRef = ref(db, `profiles/${profile}/data/realtime`);
        const snapshot = await get(realtimeRef);
        
        for (const [key, data] of Object.entries(snapshot.val())) {
            if (data.timestamp < fiveMinutesAgo) {
                await remove(ref(db, `profiles/${profile}/data/realtime/${key}`));
            }
        }
    }
}

// Run every minute
setInterval(cleanupRealtimeData, 60000);
```

### Data Validation

All incoming data must pass validation before storage:

```javascript
const VALIDATION_RULES = {
    sipm: { 
        min: 0, 
        max: 500,
        unit: 'mV',
        description: 'SiPM signal intensity'
    },
    temp: { 
        min: -40, 
        max: 85,
        unit: '°C',
        description: 'Temperature sensor reading'
    },
    pressure: { 
        min: 80000, 
        max: 120000,
        unit: 'Pa',
        description: 'Atmospheric pressure'
    },
    deadtime: {
        min: 0,
        max: 1,
        unit: 'ratio',
        description: 'Detector deadtime fraction'
    },
    coincident: {
        min: 0,
        max: 1,
        unit: 'boolean',
        description: 'Coincidence flag (requires 2 detectors)'
    }
};

function validateEvent(eventData) {
    for (const [field, value] of Object.entries(eventData)) {
        const rules = VALIDATION_RULES[field];
        if (!rules) continue;
        
        if (value < rules.min || value > rules.max) {
            console.error(`Invalid ${field}: ${value} (must be ${rules.min}-${rules.max} ${rules.unit})`);
            return false;
        }
    }
    return true;
}
```

---

## User Interface Requirements

### Layout Structure (4 Equal Sections)

```
┌─────────────────────────────────────────┐
│  Header: Profile, Session, Controls    │
├──────────────────┬──────────────────────┤
│                  │                      │
│  Event Rate      │  SiPM Signal        │
│  (events/min)    │  (mV)                │
│                  │                      │
├──────────────────┼──────────────────────┤
│                  │                      │
│  Temperature &   │  Muon Rate          │
│  Pressure        │  (muons/min)        │
│                  │                      │
└──────────────────┴──────────────────────┘
```

### Modular Chart System
- Any chart can be replaced with alternative visualization
- When coincident data unavailable, replace Muon Rate with:
  - Deadtime chart
  - Data quality indicators
  - System status
  - Custom metric

### Time Range Selector
Buttons in header:
```
[1m] [5m] [15m] [30m] [1h] [6h] [12h] [24h] [3d] [7d] [14d] [30d] [CUSTOM]
```

**Behavior**:
- 1m and 5m: Only enabled if real-time data exists
- 15m - 30d: Always available (uses minute data)
- CUSTOM: Opens date range picker

### Chart Type Toggle
```
[Accurate] / [Stacked]
```

Applies to ALL charts simultaneously.

### Chart Visualization Rules

#### 1m View (Real-time Only)
- **Enabled when**: Real-time recording active OR real-time data exists
- **Display**: Vertical "candle" bars
- **X-axis**: Absolute time, advances with real time
- **Update rate**: Sub-second precision
- **Data source**: `/data/realtime/`

**Example**:
```
Signal (mV)
200 ┤     █
    │  █  █  █
150 ├ ███████
    │  █  █
100 ┤     █
    └─────────────> Time (HH:MM:SS.ms)
```

#### 5m View (Hybrid)
- **Enabled when**: Same as 1m
- **Display**: 
  - Vertical bars for real-time data
  - Smooth curve for minute averages (exactly 5 points)
- **X-axis**: Last 5 minutes, advancing
- **Data sources**: `/data/realtime/` AND `/data/minutes/`

**Example**:
```
Signal (mV)
200 ┤  █     █  ◉───────◉
    │ ███ █ ███ │       │
150 ├◉──────────◉       ◉
    │ ███   ███
100 ┤  █     █
    └─────────────> Time (HH:MM:SS)
    
    █ = Real-time bars
    ◉ = Minute averages (5 total)
```

#### 15m - 30d Views (Minute Averages)
- **Display**: Smooth curves connecting minute averages
- **X-axis**: Fixed to selected range (Accurate) or variable (Stacked)
- **Data source**: `/data/minutes/`
- **NO simplification**: Show ALL available minute data

**Accurate Mode**:
```
Signal (mV)
200 ┤     ╭─╮
150 ├───╮╯   ╰─╮      ╭───╮
100 ┤   ╰───────╰────╯     ╰──
    └─────────────────────────> Time
    0h        12h        24h
    
    Gaps show when no data recorded
```

**Stacked Mode**:
```
Signal (mV)
200 ┤     ╭─╮╭───╮
150 ├───╮╯   ╯   ╰──
100 ┤   ╰───────────
    └─────────────> Time (variable)
    
    No gaps - sessions concatenated
```

### Responsive Design Requirements

#### Desktop (>1200px)
- 4 charts in 2x2 grid
- Large text (18-24px)
- Visible from 3+ meters away
- Full controls visible

#### Tablet (768px - 1200px)
- 4 charts in 2x2 grid
- Medium text (16-20px)
- Touch-friendly buttons
- Scrollable if needed

#### Mobile (<768px)
- Charts stack vertically
- One chart visible at time
- Swipe between charts
- Simplified controls

### Professional Aesthetics

**Avoid**:
- ❌ Generic AI-generated gradients
- ❌ Excessive emojis
- ❌ Bright, distracting colors
- ❌ Cluttered interfaces

**Use**:
- ✅ Scientific color schemes (blues, grays, whites)
- ✅ Clear grid lines on charts
- ✅ Precise axis labels
- ✅ Minimalist design
- ✅ High contrast for readability
- ✅ Consistent spacing

---

## Testing & Quality Assurance

### Pre-Deployment Checklist

#### Authentication
- [ ] New user can sign up
- [ ] Existing user can sign in
- [ ] User can sign out
- [ ] Password reset works
- [ ] Email verification (if enabled)

#### Profile Management
- [ ] Create new profile
- [ ] Edit profile details
- [ ] Delete profile (with confirmation)
- [ ] View public profiles
- [ ] Private profiles hidden from non-owners

#### Permissions
- [ ] Admin sees admin panel
- [ ] Non-admin cannot access admin panel
- [ ] Profile owner can edit their profile
- [ ] Editors can edit assigned profiles
- [ ] Viewers can only view assigned profiles

#### Data Recording
- [ ] Connect to serial port
- [ ] Start recording session
- [ ] Stop recording session
- [ ] Data appears in charts
- [ ] Data saved to database

#### Data Accuracy
- [ ] Minute data shows **averages** not sums
- [ ] SiPM values in reasonable range (0-500 mV)
- [ ] Temperature values reasonable (-40 to 85°C)
- [ ] Event counts accurate
- [ ] Timestamps correct (GMT-5)

#### Chart Display
- [ ] 15m, 30m, 1h, 6h, 12h, 24h, 3d, 7d, 14d, 30d all work
- [ ] Charts update in real-time during recording
- [ ] Zoom/pan functionality works
- [ ] Chart type toggle works (Accurate/Stacked)
- [ ] 1m and 5m disabled when no real-time data
- [ ] 1m shows vertical bars correctly
- [ ] 5m shows bars AND curve (5 points only)

#### Data Export
- [ ] CSV export downloads
- [ ] CSV contains correct data
- [ ] Filename includes profile and date
- [ ] All fields present in export

#### Admin Functions
- [ ] View all users
- [ ] Change user roles
- [ ] View database size
- [ ] Access error logs
- [ ] Database migration tools work

#### Database Cleanup
- [ ] Real-time data older than 5 min gets deleted
- [ ] Cleanup runs automatically
- [ ] Database size doesn't grow uncontrollably
- [ ] Minute data preserved indefinitely

#### UI/UX
- [ ] All buttons functional
- [ ] Responsive on mobile
- [ ] Responsive on tablet
- [ ] Readable from distance
- [ ] Theme toggle works
- [ ] Language toggle works (if implemented)
- [ ] No console errors
- [ ] Loading states display properly

### Performance Testing

#### Load Testing
- [ ] Multiple users can view simultaneously
- [ ] Multiple detectors can record simultaneously
- [ ] Charts don't lag with large datasets
- [ ] Database queries optimize correctly

#### Stress Testing
- [ ] 24-hour continuous recording
- [ ] 7-day continuous recording
- [ ] Database size after 30 days < 500 MB
- [ ] Memory leaks checked
- [ ] Browser doesn't crash

#### Edge Cases
- [ ] Empty profile (no sessions)
- [ ] Session with no data
- [ ] Extremely high event rate
- [ ] Invalid serial data handled gracefully
- [ ] Network disconnection during recording
- [ ] Concurrent writes to same profile

---

## Common Pitfalls & How to Avoid Them

### Pitfall 1: Summing Instead of Averaging
**Problem**: Showing 28,000,000 mV instead of 280 mV

**Solution**:
```javascript
// Always divide by count
const avg = sum / count;
// NEVER just return sum
```

### Pitfall 2: Hardcoding Admin UIDs
**Problem**: Only specific hardcoded user is admin

**Solution**:
```javascript
// Read from database
const role = await getUserRole(uid);
```

### Pitfall 3: No Real-time Cleanup
**Problem**: Database grows to gigabytes in days

**Solution**:
```javascript
// Continuous cleanup loop
setInterval(async () => {
    await deleteRealtimeDataOlderThan5Minutes();
}, 60000);
```

### Pitfall 4: Displaying Too Many Points
**Problem**: Chart shows 10,000 points for 5 minutes

**Solution**:
```javascript
// For minute averages, show exactly N points
// For 5m: show 5 points (one per minute)
// For 1h: show 60 points (one per minute)
```

### Pitfall 5: Non-Responsive Design
**Problem**: Unusable on mobile devices

**Solution**:
```css
/* Use CSS Grid with media queries */
@media (max-width: 768px) {
    .chart-container {
        grid-template-columns: 1fr;
    }
}
```

### Pitfall 6: Monolithic Code Files
**Problem**: 2000-line single file impossible to maintain

**Solution**:
```
Separate into modules:
- config.js (constants)
- firebase-client.js (database)
- serial-reader.js (hardware)
- data-processor.js (logic)
- charts.js (visualization)
- ui.js (interface)
- app.js (orchestration)
```

### Pitfall 7: Unclear Error Messages
**Problem**: "Error" without context

**Solution**:
```javascript
throw new Error(
    `Failed to save data to profile ${profileId}: ${error.message}. ` +
    `Check database permissions and network connection.`
);
```

### Pitfall 8: No Input Validation
**Problem**: Corrupt data in database

**Solution**:
```javascript
if (!validateEvent(data)) {
    console.error(`Invalid data rejected: ${JSON.stringify(data)}`);
    return;
}
```

---

## Key Success Metrics

### Technical Metrics
- **Database size growth**: < 2 MB per day per active detector
- **Page load time**: < 2 seconds on 3G connection
- **Chart update latency**: < 500ms for real-time data
- **Memory usage**: < 200 MB in browser after 24 hours
- **Code coverage**: > 80% of functions tested

### User Experience Metrics
- **Setup time**: < 5 minutes from clone to first recording
- **Learning curve**: Non-programmer can use within 15 minutes
- **Mobile usability**: All functions accessible on phone
- **Error recovery**: Clear path forward for all errors

### Scientific Metrics
- **Data accuracy**: 100% of minute averages mathematically correct
- **Data completeness**: Zero data loss during continuous recording
- **Timestamp precision**: ± 1 second for minute data
- **Real-time precision**: ± 100ms for instantaneous data

---

## Version History & Evolution

### MuNRa 1.0
- Initial Python desktop application
- Local SQLite database
- Basic chart visualization
- Single detector support

### MuNRa 2.0
- Migration to web platform
- Firebase integration
- Multi-profile support
- Real-time updates

### MuNRa 3.0 - 3.2
- Role-based access control
- Session management
- Enhanced charts
- Admin panel
- **Major bugs**: Sum instead of average, no cleanup

### MuNRa 4.0 (Current Development)
**Goals**:
- Fix critical averaging bug
- Implement real-time data cleanup
- Browser-based serial reading
- Enhanced admin panel
- Organization system
- Professional UI redesign
- Complete code refactoring

**Expected Outcome**:
A production-ready, globally scalable platform for particle detector data visualization that can run reliably 24/7 for months and support hundreds of concurrent users and detectors.

---

## Final Notes for AI Assistants

### Context Preservation
When continuing work on this project:
1. **Read this entire document first**
2. **Review all existing code files**
3. **Check the current database state**
4. **Verify all functionality before deployment**
5. **Test on multiple browsers and devices**

### Communication Style
- Be precise and technical
- Cite specific file names and line numbers
- Explain the "why" behind decisions
- Suggest alternatives when appropriate
- Flag potential issues proactively

### Code Quality Standards
- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It
- **SOLID**: Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion

### Commit Messages
```
feat: Add real-time data cleanup loop
fix: Correct averaging calculation in data-processor.js
refactor: Modularize chart rendering into charts.js
docs: Update README with deployment instructions
test: Add validation tests for event data
```

### Documentation Requirements
Every function should have:
```javascript
/**
 * Calculates average values for events within one minute
 * 
 * @param {Array} events - Array of raw event objects
 * @returns {Object} Aggregated minute data with averages
 * 
 * @example
 * const minuteData = aggregateMinute([
 *   { sipm: 150, temp: 22 },
 *   { sipm: 160, temp: 23 }
 * ]);
 * // Returns: { sipm_avg: 155, temp_avg: 22.5, ... }
 */
function aggregateMinute(events) {
    // Implementation
}
```

---

## Contact & Resources

### Firebase Console
- Project: `munra-1`
- Database URL: `https://munra-1-default-rtdb.firebaseio.com/`
- Hosting URL: `https://munra-1.web.app/`
- Backup Database: `https://munra-backup-default-rtdb.firebaseio.com/`

### External Documentation
- MuNRa Hardware Docs: https://gitmilab.redclara.net/muografia/escaramujo/munra_como_usar/-/tree/main?ref_type=heads
- Firebase Docs: https://firebase.google.com/docs
- Web Serial API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
- Chart.js: https://www.chartjs.org/docs/

### Project Repository
- GitHub: https://github.com/alexanderkholodov1/CosmicRay
- License: Open Source (MIT or similar)
- Contributors: Open to community contributions

---

**Last Updated**: February 3, 2026
**Version**: 4.0 
**Status**: Active Development - Security & Serial API improvements implemented

---

## Recent Changes Log

### February 3, 2026
- ✅ Fixed security vulnerability: Removed hardcoded admin UID
- ✅ Implemented proper Firebase database security rules
- ✅ Added `.gitignore` to exclude credentials from repository
- ✅ Created Web Serial API implementation (serial-reader.js)
- ✅ Added automatic real-time data cleanup (5 minute retention)
- ✅ Created GitHub Actions workflow for CI/CD deployment
- ✅ Added deployment documentation (FIREBASE_DEPLOYMENT.md)
- ✅ Updated this documentation to reflect current state

---

*This document should be updated whenever significant changes are made to the project architecture, requirements, or implementation details.*

---

## Recent Changes Log (Continued)

### February 3, 2026 - Major Feature Update

#### Performance Optimizations (PENDING USER VERIFICATION)
- ✅ Implemented LTTB (Largest-Triangle-Three-Buckets) data downsampling algorithm
- ✅ Charts now automatically downsample to max 500 points for performance
- ✅ Prevents browser freezing with hundreds/thousands of data points
- ✅ Admin panel now loads users and profiles in parallel (was sequential)
- ✅ Added 30-second caching for admin panel data
- ✅ Added loading indicators for admin panel tables
- ⏳ **NEEDS VERIFICATION**: Test with large datasets (500+ records)

#### New Chart Types (PENDING USER VERIFICATION)  
- ✅ Added "Line Only" chart type (line without point markers)
- ✅ Added "Smooth Curve" chart type (bezier interpolation)
- ✅ Chart types now saved to localStorage per chart
- ✅ 5 total chart types: Line+Dots, Line Only, Smooth, Bar, Scatter
- ⏳ **NEEDS VERIFICATION**: Cycle through all types and verify visual appearance

#### Profile Folder Organization (PENDING USER VERIFICATION)
- ✅ Main profile dropdown now organized into optgroups:
  - "Recent" - Last 5 accessed profiles
  - "My Profiles" - Profiles user owns
  - "Shared with Me" - Profiles shared with user
  - "Public Profiles" - All public profiles
- ✅ Profiles sorted alphabetically within each category
- ✅ Recent profiles tracked in localStorage
- ⏳ **NEEDS VERIFICATION**: Create multiple profiles and verify organization

#### Profile ID Renaming Feature (PENDING USER VERIFICATION)
- ✅ Added "Rename ID" button in Manage Profiles modal
- ✅ Migrates ALL data (sessions, minutes, realtime) to new profile ID
- ✅ Deletes old profile after successful migration
- ✅ Validates new ID (lowercase, no spaces, no duplicates)
- ✅ Updates localStorage references automatically
- ⏳ **NEEDS VERIFICATION**: Rename a profile with data and verify integrity

#### Admin Panel Speed Improvements (PENDING USER VERIFICATION)
- ✅ Parallel loading of users and profiles (was sequential)
- ✅ Data caching for 30 seconds to avoid repeated queries
- ✅ Loading indicators shown while data loads
- ✅ Error states displayed in table instead of just toast
- ⏳ **NEEDS VERIFICATION**: Open admin panel and measure load time

---

## Verification Checklist for User

Before considering these features complete, please verify:

### Performance
- [ ] Load a profile with 500+ data points - does the browser freeze?
- [ ] Switch between time ranges (1h, 24h, ALL) - are transitions smooth?
- [ ] Open admin panel - does it load in under 3 seconds?

### Chart Types  
- [ ] Click "Change Chart Type" button - cycles through all 5 types?
- [ ] Refresh page - does chart type preference persist?
- [ ] "Line Only" shows clean line without dots?
- [ ] "Smooth Curve" shows bezier-interpolated curves?

### Profile Organization
- [ ] Profile dropdown shows optgroup headers (Recent, My Profiles, etc.)?
- [ ] Recently accessed profiles appear in "Recent" section?
- [ ] Your own profiles appear in "My Profiles" section?

### Profile Renaming
- [ ] "Rename ID" button visible in Manage Profiles?
- [ ] Renaming a profile migrates all data correctly?
- [ ] Old profile ID is deleted after rename?
- [ ] New profile works normally after rename?

---

*Please mark items as verified or report issues.*
