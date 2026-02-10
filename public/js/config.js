/**
 * MuNRa 4.8.0 - Configuration Module
 * 
 * Central configuration for Firebase, chart styling, time ranges,
 * performance limits, and data validation constants.
 * 
 * NO application logic belongs here — only values and references.
 */

// ─── Firebase ───────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyBEK9jPwoEuFRK_5HBTzZxaLYH3PrLW0xA',
    authDomain: 'munra-1.firebaseapp.com',
    databaseURL: 'https://munra-1-default-rtdb.firebaseio.com',
    projectId: 'munra-1',
    storageBucket: 'munra-1.appspot.com',
    messagingSenderId: '182767247922',
    appId: '1:182767247922:web:86bd4e2e3e3fa699a3d22b'
});

const DEFAULT_FIREBASE_URL = FIREBASE_CONFIG.databaseURL;

// ─── Performance ────────────────────────────────────────────────────────────
const PERF = Object.freeze({
    /** Max data points rendered per chart (LTTB will downsample beyond this) */
    MAX_CHART_POINTS: 500,
    /** Min milliseconds between chart redraws (RAF-throttled) */
    CHART_THROTTLE_MS: 1000,
    /** How often the time-axis advances in ACCURATE mode (ms) */
    TIME_AXIS_INTERVAL_MS: 10_000,
    /** Realtime cleanup interval (ms) */
    CLEANUP_INTERVAL_MS: 60_000,
    /** Realtime data retention window (ms) — 8 minutes (buffer for clock skew) */
    REALTIME_RETENTION_MS: 8 * 60 * 1000,
    /** Max realtime points in local memory (~8 min at 11 events/sec) */
    REALTIME_LIMIT: 5000,
    /** Admin data cache TTL (ms) */
    ADMIN_CACHE_TTL_MS: 30_000,
    /** Extra ms of data to include beyond chart edges for line continuity */
    CHART_EDGE_BUFFER_MS: 2 * 60 * 1000
});

// ─── Chart Colors ───────────────────────────────────────────────────────────
const COLORS = Object.freeze({
    events:    '#00d4ff',
    muons:     '#ff6b35',
    sipmAvg:   '#00ff88',
    sipmMax:   '#ff6b35',
    sipmMin:   '#7b2cbf',
    temp:      '#ff6b35',
    pressure:  '#7b2cbf',
    deadtime:  '#d29922',
    // Realtime overlay colors (used in 5m dual-line view)
    rtEvents:  'rgba(0,212,255,0.35)',
    rtMuons:   'rgba(255,107,53,0.35)',
    rtSipm:    'rgba(0,255,136,0.35)',
    rtTemp:    'rgba(255,107,53,0.35)',
    rtPressure:'rgba(123,44,191,0.35)',
    rtDeadtime:'rgba(210,153,34,0.35)',
    grid:      'rgba(255,255,255,0.05)',
    tick:      '#8b949e'
});

// ─── Chart Type Cycle ───────────────────────────────────────────────────────
const CHART_TYPES = Object.freeze(['line', 'line-only', 'smooth', 'smooth-no-dots', 'bar', 'scatter']);

const CHART_TYPE_LABELS = Object.freeze({
    'line':           'Line + Dots',
    'line-only':      'Line Only',
    'smooth':         'Smooth + Dots',
    'smooth-no-dots': 'Smooth Curve',
    'bar':            'Bar Chart',
    'scatter':        'Scatter'
});

// ─── Time Ranges ────────────────────────────────────────────────────────────
/** All supported time-range button values (minutes or special strings). */
const TIME_RANGES = Object.freeze([
    1, 5, 15, 30, 60, 360, 720, 1440,
    4320, 10080, 20160, 43200,
    'all', 'custom'
]);

// ─── Data Field Abbreviations ───────────────────────────────────────────────
/** Mapping from short DB keys to human-readable names (for CSV headers, tooltips). */
const FIELD_LABELS = Object.freeze({
    ec: 'Events/min',
    cc: 'Muons/min',
    sm: 'SiPM Avg (mV)',
    sn: 'SiPM Min (mV)',
    sx: 'SiPM Max (mV)',
    tp: 'Temperature (°C)',
    pr: 'Pressure (Pa)',
    dt: 'Dead Time (%)'
});

// ─── Gap Detection ──────────────────────────────────────────────────────────
/** If two consecutive data points are more than this apart, insert a null to break the line. */
const GAP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
