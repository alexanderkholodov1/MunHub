# AI_CONTEXT.md - MuNRa 4.0

## Purpose
This file provides context for AI assistants working on this project.

## CRITICAL INFORMATION

### 1. THIS IS A WEB-ONLY APPLICATION
- NO local Python application
- NO install.sh
- NO CLI tools
- Everything runs in the browser
- Deployed via Firebase Hosting

### 2. DATA AGGREGATION MUST BE AVERAGES
The biggest bug in previous versions was summing values instead of averaging.

**CORRECT CODE in data-processor.js flushMinute():**
```javascript
sipm_avg: sipmSum / eventCount,  // DIVIDE by count!
temp_avg: tempSum / eventCount,
pressure_avg: pressureSum / eventCount,
deadtime_avg: deadtimeSum / eventCount,
```

**NEVER** change this to just `sipmSum` - that's the bug that showed 28,000,000 mV!

### 3. ADMIN UID MUST NOT BE HARDCODED
Previous versions had:
```javascript
if (uid === 'HARDCODED_UID') return 'admin';  // WRONG!
```

**CORRECT**: Read role from database:
```javascript
const snapshot = await get(ref(db, `users/${uid}/role`));
return snapshot.val() || 'viewer';
```

### 4. CONSOLE OUTPUT USES NEWLINES
Use `\n` not `\r` for terminal output. Each line must be on its own line.

### 5. WEB SERIAL API REQUIREMENTS
- Only works in Chrome and Edge
- Requires HTTPS (Firebase Hosting provides this)
- User must grant permission

## Architecture

```
Browser
├── index.html (loads all JS)
├── JS Modules
│   ├── config.js (constants, validation)
│   ├── firebase-client.js (auth, database)
│   ├── serial-reader.js (Web Serial API)
│   ├── data-processor.js (parse/aggregate)
│   ├── charts.js (Chart.js wrapper)
│   ├── ui.js (DOM interactions)
│   ├── admin.js (admin panel)
│   └── app.js (orchestration)
└── Firebase (backend)
    ├── Authentication
    ├── Realtime Database
    └── Hosting
```

## Database Structure

```
/profiles/{profileId}
    name, owner, ownerEmail, description, location, coordinates, 
    isPublic, editors[], viewers[], created, updated

/profiles/{profileId}/sessions/{sessionId}
    name, description, startTime, endTime, minuteCount

/profiles/{profileId}/data/minutes/{minuteKey}
    event_count, muon_count, sipm_avg, sipm_min, sipm_max,
    temp_avg, pressure_avg, deadtime_avg

/profiles/{profileId}/data/realtime/{timestamp}
    (same as minutes, for live display)

/users/{uid}
    email, role, created
```

## Validation

Values are validated in data-processor.js validateEvent():

```javascript
VALIDATION: {
    sipm: { min: 0, max: 500 },      // mV
    temp: { min: -40, max: 85 },      // Celsius
    pressure: { min: 80000, max: 120000 }  // Pa
}
```

## Common Issues to Avoid

1. **Don't create local files** - Everything is web-based
2. **Don't accumulate sums** - Always divide by count for averages
3. **Don't hardcode UIDs** - Read roles from database
4. **Don't use carriage returns** - Use newlines for terminal
5. **Don't use emojis** - Keep interface professional
6. **Don't enable 1m/5m without realtime data** - Check hasRealtimeData()
7. **Don't skip data validation** - Invalid values corrupt statistics

## Feature Checklist

- [x] Firebase Hosting deployment
- [x] Web Serial API integration
- [x] Firebase Authentication
- [x] Role-based access control
- [x] Data aggregation (AVERAGES!)
- [x] Multiple profiles support
- [x] Session management
- [x] Real-time chart updates
- [x] Zoom/pan on charts
- [x] CSV export
- [x] Admin panel
- [x] Database cleanup
- [x] Theme toggle (dark/light)
- [x] Mobile responsive

## Testing Checklist

- [ ] Sign up new user
- [ ] Sign in existing user
- [ ] Create profile
- [ ] Connect serial port
- [ ] Start/stop recording
- [ ] Verify minute data shows AVERAGES not sums
- [ ] Check 1m/5m buttons disabled without realtime
- [ ] Admin can see admin panel
- [ ] Non-admin cannot see admin panel
- [ ] Public profiles visible to all
- [ ] Private profiles only visible to owner/editors/viewers
- [ ] Export CSV works
- [ ] Theme toggle works
