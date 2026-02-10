/**
 * MunHub 5.0 — Configuration Module
 *
 * Central configuration for Firebase, chart styling, time ranges,
 * performance limits, and data validation constants.
 *
 * NO application logic belongs here — only values and references.
 */

const APP_VERSION = '5.0';
const APP_NAME    = 'MunHub';
const APP_BUILD   = 'Feb 2026';

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
    MAX_CHART_POINTS: 500,
    CHART_THROTTLE_MS: 1000,
    TIME_AXIS_INTERVAL_MS: 10_000,
    CLEANUP_INTERVAL_MS: 60_000,
    REALTIME_RETENTION_MS: 8 * 60 * 1000,
    REALTIME_LIMIT: 5000,
    ADMIN_CACHE_TTL_MS: 30_000,
    CHART_EDGE_BUFFER_MS: 2 * 60 * 1000
});

// ─── Chart Colors — Cosmic / Lunar palette ──────────────────────────────────
// Base colors for simplified/minute-average data lines
// Realtime overlay colors are DISTINCT hues (not just opacity variants)
const COLORS = Object.freeze({
    // Simplified / minute data
    events:    '#40c4aa',   // particle teal
    muons:     '#f0c040',   // star gold
    sipmAvg:   '#5090e0',   // cosmic blue
    sipmMax:   '#e07050',   // supernova coral
    sipmMin:   '#9070e0',   // nebula violet
    temp:      '#e07050',   // supernova coral
    pressure:  '#9070e0',   // nebula violet
    deadtime:  '#d4a020',   // solar amber

    // Realtime overlay — DIFFERENT hues from base (clearly distinguishable)
    rtEvents:  '#80f0c0',   // mint green (vs teal)
    rtMuons:   '#f09040',   // deep orange (vs gold)
    rtSipm:    '#70b8f0',   // sky blue (vs cosmic blue)
    rtTemp:    '#f09040',   // deep orange (vs coral)
    rtPressure:'#c090f0',   // lavender (vs violet)
    rtDeadtime:'#f0d060',   // pale gold (vs amber)

    // Axis / grid
    grid:      'rgba(224,230,240,0.06)',
    tick:      '#7a8599'
});

// ─── Default Chart Customization ────────────────────────────────────────────
const CHART_DEFAULTS = Object.freeze({
    dotSize: 3,         // scatter point radius
    barWidth: 0.85,     // bar percentage (0.1–1.0)
    tension: 0.4        // smooth line curvature (0–1)
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
const TIME_RANGES = Object.freeze([
    1, 5, 15, 30, 60, 360, 720, 1440,
    4320, 10080, 20160, 43200,
    'all', 'custom'
]);

// ─── Data Field Abbreviations ───────────────────────────────────────────────
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

// ─── Chart Info Descriptions (for ℹ buttons) ────────────────────────────────
const CHART_INFO = Object.freeze({
    events: {
        title: 'Event Rate',
        desc: 'Counts of cosmic ray events and muon coincidences detected per minute. Events/min shows total particle detections. Muons/min shows coincidence-filtered muon candidates.'
    },
    sipm: {
        title: 'SiPM Signal',
        desc: 'Silicon Photomultiplier (SiPM) voltage readings in millivolts. Shows average, minimum, and maximum signal amplitude per minute. Higher values indicate more energetic particle interactions.'
    },
    temp: {
        title: 'Temperature & Pressure',
        desc: 'Environmental sensor readings from the CosmicWatch detector. Temperature in °C and atmospheric pressure in hPa. These affect detector performance and can correlate with cosmic ray flux variations.'
    },
    deadtime: {
        title: 'Dead Time',
        desc: 'Percentage of time the detector is unable to register new events (processing previous events). High dead time (>10%) may indicate excessive event rates or hardware issues.'
    }
});

// ─── Gap Detection ──────────────────────────────────────────────────────────
const GAP_THRESHOLD_MS = 2 * 60 * 1000;
