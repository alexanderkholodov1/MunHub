/**
 * MuNRa 3.0 - Main Application
 * 
 * CRITICAL: ACCURATE mode = FIXED time axis (shows exact time range with gaps)
 *           STACKED mode = AUTO-FIT axis (fits data to fill chart)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_FIREBASE_URL = 'https://munra-1-default-rtdb.firebaseio.com';
let db = null;
let currentProfile = '';
let allProfiles = {};
let sessionsData = {};
let allData = [];
let realtimeData = [];
let realtimeRef = null;
let latestData = null;

// State
let globalTimeRange = 15; // minutes, or 'all' for all data, or 'custom' for custom range
let customTimeStart = null;
let customTimeEnd = null;
let isStackedMode = false; // false = ACCURATE (fixed axis), true = STACKED (auto-fit)
let isLightMode = false;
let charts = {};
let chartTypes = { events: 'line', sipm: 'line', temp: 'line', deadtime: 'line' };

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadPreferences();
    initFirebase();
    initCharts();
    setupEventListeners();
    setupCustomRangeListeners();
    startTimeAxisUpdate();
});

function loadPreferences() {
    isStackedMode = localStorage.getItem('munra_stacked') === 'true';
    isLightMode = localStorage.getItem('munra_theme') === 'light';
    const savedRange = localStorage.getItem('munra_range');
    globalTimeRange = savedRange === 'all' || savedRange === 'custom' ? savedRange : (parseInt(savedRange) || 15);
    
    document.getElementById('modeSwitch').checked = isStackedMode;
    updateModeLabels();
    
    if (isLightMode) {
        document.body.setAttribute('data-theme', 'light');
    }
    
    // Set active time button
    document.querySelectorAll('.time-btn').forEach(btn => {
        const range = btn.dataset.range;
        const isActive = range === globalTimeRange.toString() || 
                        (range === 'all' && globalTimeRange === 'all') ||
                        (range === 'custom' && globalTimeRange === 'custom');
        btn.classList.toggle('active', isActive);
    });
    
    // Load saved Firebase URL
    const savedUrl = localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
    document.getElementById('firebaseUrl').value = savedUrl;
}

function initFirebase(url = null) {
    const firebaseUrl = url || localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
    
    // Full Firebase config (required for Auth)
    const firebaseConfig = {
        apiKey: "AIzaSyBEK9jPwoEuFRK_5HBTzZxaLYH3PrLW0xA",
        authDomain: "munra-1.firebaseapp.com",
        databaseURL: firebaseUrl,
        projectId: "munra-1",
        storageBucket: "munra-1.appspot.com",
        messagingSenderId: "182767247922",
        appId: "1:182767247922:web:86bd4e2e3e3fa699a3d22b"
    };
    
    try {
        if (firebase.apps.length > 0) {
            firebase.app().delete().then(() => {
                firebase.initializeApp(firebaseConfig);
                db = firebase.database();
                loadProfiles();
            });
        } else {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            loadProfiles();
        }
    } catch (e) {
        console.error('Firebase init error:', e);
        setConnectionStatus('error', 'Connection failed');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHARTS - Using Chart.js TIME scale for ACCURATE mode
// ═══════════════════════════════════════════════════════════════════════════════
function initCharts() {
    // Custom tooltip that shows REAL time even in STACKED mode
    const tooltipCallbacks = {
        title: function(context) {
            if (context[0] && context[0].raw && context[0].raw.realTime) {
                // In STACKED mode, show the real timestamp
                return new Date(context[0].raw.realTime).toLocaleString();
            }
            // In ACCURATE mode, just use the x value
            return new Date(context[0].parsed.x).toLocaleString();
        }
    };
    
    const commonOptions = (yLabel = '') => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { 
                display: true, 
                position: 'top', 
                labels: { boxWidth: 10, padding: 6, font: { size: 10 }, color: '#8b949e' }
            },
            tooltip: {
                callbacks: tooltipCallbacks
            }
        },
        scales: {
            x: {
                type: 'time',  // CRITICAL: Use time scale for accurate time representation
                time: {
                    unit: 'minute',
                    displayFormats: {
                        second: 'HH:mm:ss',
                        minute: 'HH:mm',
                        hour: 'HH:mm',
                        day: 'MMM d'
                    }
                },
                ticks: { 
                    color: '#8b949e', 
                    font: { size: 9 },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 8
                },
                grid: { color: 'rgba(255,255,255,0.05)' },
                // min and max will be set dynamically for ACCURATE mode
            },
            y: {
                ticks: { color: '#8b949e', font: { size: 9 } },
                grid: { color: 'rgba(255,255,255,0.05)' },
                title: yLabel ? { display: true, text: yLabel, color: '#8b949e', font: { size: 9 } } : {}
            }
        }
    });

    // Events Chart
    charts.events = new Chart(document.getElementById('chartEvents'), {
        type: 'line',
        data: {
            datasets: [
                { 
                    label: 'Events/min', 
                    data: [], 
                    borderColor: '#00d4ff', 
                    backgroundColor: 'rgba(0,212,255,0.1)',
                    tension: 0, 
                    pointRadius: 2, 
                    borderWidth: 1.5,
                    fill: false,
                    spanGaps: false  // Don't connect points across null gaps
                },
                { 
                    label: 'Muons/min', 
                    data: [], 
                    borderColor: '#ff6b35', 
                    backgroundColor: 'rgba(255,107,53,0.1)',
                    tension: 0, 
                    pointRadius: 2, 
                    borderWidth: 1.5,
                    fill: false,
                    spanGaps: false
                }
            ]
        },
        options: commonOptions()
    });

    // SiPM Chart
    charts.sipm = new Chart(document.getElementById('chartSipm'), {
        type: 'line',
        data: {
            datasets: [
                { label: 'Avg mV', data: [], borderColor: '#00ff88', tension: 0, pointRadius: 2, borderWidth: 1.5, spanGaps: false },
                { label: 'Max mV', data: [], borderColor: '#ff6b35', tension: 0, pointRadius: 1, borderWidth: 1, borderDash: [3,2], spanGaps: false },
                { label: 'Min mV', data: [], borderColor: '#7b2cbf', tension: 0, pointRadius: 1, borderWidth: 1, borderDash: [3,2], spanGaps: false }
            ]
        },
        options: commonOptions('mV')
    });

    // Temperature Chart
    charts.temp = new Chart(document.getElementById('chartTemp'), {
        type: 'line',
        data: {
            datasets: [
                { label: '°C', data: [], borderColor: '#ff6b35', yAxisID: 'y', tension: 0, pointRadius: 2, borderWidth: 1.5, spanGaps: false },
                { label: 'hPa', data: [], borderColor: '#7b2cbf', yAxisID: 'y1', tension: 0, pointRadius: 2, borderWidth: 1.5, spanGaps: false }
            ]
        },
        options: {
            ...commonOptions(),
            scales: {
                ...commonOptions().scales,
                y: { 
                    type: 'linear', 
                    position: 'left', 
                    ticks: { color: '#ff6b35', font: { size: 9 } }, 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: '°C', color: '#ff6b35', font: { size: 9 } }
                },
                y1: { 
                    type: 'linear', 
                    position: 'right', 
                    ticks: { color: '#7b2cbf', font: { size: 9 } }, 
                    grid: { display: false },
                    title: { display: true, text: 'hPa', color: '#7b2cbf', font: { size: 9 } }
                }
            }
        }
    });

    // Dead Time Chart
    charts.deadtime = new Chart(document.getElementById('chartDeadtime'), {
        type: 'line',
        data: {
            datasets: [
                { label: 'Dead Time %', data: [], borderColor: '#d29922', tension: 0, pointRadius: 2, borderWidth: 1.5, spanGaps: false }
            ]
        },
        options: commonOptions('%')
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART UPDATE - ACCURATE vs STACKED mode
// ═══════════════════════════════════════════════════════════════════════════════
function updateCharts() {
    const now = Date.now();
    let minTime, maxTime, filteredData;
    
    if (globalTimeRange === 'all') {
        // ALL mode: show all data
        filteredData = [...allData];
        if (filteredData.length > 0) {
            minTime = filteredData[0].timestamp * 1000;
            maxTime = filteredData[filteredData.length - 1].timestamp * 1000;
        } else {
            minTime = now - 15 * 60 * 1000;
            maxTime = now;
        }
    } else if (globalTimeRange === 'custom' && customTimeStart && customTimeEnd) {
        // CUSTOM mode: use custom range
        minTime = customTimeStart;
        maxTime = customTimeEnd;
        filteredData = allData.filter(d => {
            const ts = d.timestamp * 1000;
            return ts >= minTime && ts <= maxTime;
        });
    } else {
        // Normal time range mode
        const rangeMs = (typeof globalTimeRange === 'number' ? globalTimeRange : 15) * 60 * 1000;
        
        if (isStackedMode) {
            // ═══════════════════════════════════════════════════════════════════
            // STACKED MODE: Show last N minutes of DATA (not time)
            // If you select 1h, show the last 60 data points that exist
            // ═══════════════════════════════════════════════════════════════════
            const minutesWanted = typeof globalTimeRange === 'number' ? globalTimeRange : 15;
            // Take the last N data points (each point = 1 minute of data)
            filteredData = allData.slice(-minutesWanted);
            if (filteredData.length > 0) {
                minTime = filteredData[0].timestamp * 1000;
                maxTime = filteredData[filteredData.length - 1].timestamp * 1000;
            } else {
                minTime = now - rangeMs;
                maxTime = now;
            }
        } else {
            // ACCURATE MODE: Show exact time range from now
            minTime = now - rangeMs;
            maxTime = now;
            filteredData = allData.filter(d => {
                const ts = d.timestamp * 1000;
                return ts >= minTime && ts <= maxTime;
            });
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STACKED MODE: Create consecutive timestamps without gaps
    // Each data point gets a virtual timestamp 1 minute apart
    // ═══════════════════════════════════════════════════════════════════════════
    let chartData = filteredData;
    let chartMinTime = minTime;
    let chartMaxTime = maxTime;
    
    if (isStackedMode && filteredData.length > 0) {
        // Create virtual consecutive timestamps starting from first data point
        const baseTime = filteredData[0].timestamp * 1000;
        chartData = filteredData.map((d, i) => ({
            ...d,
            virtualTs: baseTime + (i * 60 * 1000)  // Each point 1 minute apart
        }));
        chartMinTime = baseTime;
        chartMaxTime = baseTime + ((filteredData.length - 1) * 60 * 1000);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ACCURATE MODE: Insert nulls for gaps > 2 minutes to break the line
    // ═══════════════════════════════════════════════════════════════════════════
    if (!isStackedMode && chartData.length > 1) {
        const dataWithGaps = [];
        const GAP_THRESHOLD = 2 * 60 * 1000; // 2 minutes
        
        for (let i = 0; i < chartData.length; i++) {
            dataWithGaps.push(chartData[i]);
            
            // Check if there's a gap to the next point
            if (i < chartData.length - 1) {
                const currentTs = chartData[i].timestamp * 1000;
                const nextTs = chartData[i + 1].timestamp * 1000;
                const gap = nextTs - currentTs;
                
                if (gap > GAP_THRESHOLD) {
                    // Insert a null point to break the line
                    dataWithGaps.push({
                        timestamp: (currentTs + 1000) / 1000, // 1 second after current
                        isGap: true
                    });
                }
            }
        }
        chartData = dataWithGaps;
    }
    
    // Prepare data points - use virtualTs in STACKED mode, real timestamp in ACCURATE
    const getX = (d) => isStackedMode ? d.virtualTs : (d.timestamp * 1000);
    const getY = (d, field) => d.isGap ? null : (d[field] || 0);
    const getYNull = (d, field) => d.isGap ? null : (d[field] || null);
    
    const eventsData = chartData.map(d => ({ x: getX(d), y: getY(d, 'ec'), realTime: d.timestamp * 1000 }));
    const muonsData = chartData.map(d => ({ x: getX(d), y: getY(d, 'cc'), realTime: d.timestamp * 1000 }));
    const sipmAvgData = chartData.map(d => ({ x: getX(d), y: getY(d, 'sm'), realTime: d.timestamp * 1000 }));
    const sipmMaxData = chartData.map(d => ({ x: getX(d), y: getY(d, 'sx'), realTime: d.timestamp * 1000 }));
    const sipmMinData = chartData.map(d => ({ x: getX(d), y: getY(d, 'sn'), realTime: d.timestamp * 1000 }));
    const tempData = chartData.map(d => ({ x: getX(d), y: getYNull(d, 'tp'), realTime: d.timestamp * 1000 }));
    const pressureData = chartData.map(d => ({ x: getX(d), y: d.isGap ? null : (d.pr ? d.pr / 100 : null), realTime: d.timestamp * 1000 }));
    const deadtimeData = chartData.map(d => ({ x: getX(d), y: d.isGap ? null : (d.dt ?? 0), realTime: d.timestamp * 1000 }));
    
    // Update all charts
    updateSingleChart(charts.events, [eventsData, muonsData], chartMinTime, chartMaxTime);
    updateSingleChart(charts.sipm, [sipmAvgData, sipmMaxData, sipmMinData], chartMinTime, chartMaxTime);
    updateSingleChart(charts.temp, [tempData, pressureData], chartMinTime, chartMaxTime);
    updateSingleChart(charts.deadtime, [deadtimeData], chartMinTime, chartMaxTime);
    
    // Update stats
    updateStats(filteredData);
}

function updateSingleChart(chart, datasets, minTime, maxTime) {
    // Update data
    datasets.forEach((data, i) => {
        if (chart.data.datasets[i]) {
            chart.data.datasets[i].data = data;
        }
    });
    
    // CRITICAL: Apply ACCURATE vs STACKED mode to X axis
    if (!isStackedMode) {
        // ═══════════════════════════════════════════════════════════════════
        // ACCURATE MODE: Fixed time axis from minTime to maxTime
        // Even if there's no data, the axis shows the full range
        // Data appears exactly where it was recorded in time
        // ═══════════════════════════════════════════════════════════════════
        chart.options.scales.x.min = minTime;
        chart.options.scales.x.max = maxTime;
        
        // Set appropriate time unit based on range
        const rangeMinutes = (maxTime - minTime) / 60000;
        if (rangeMinutes <= 5) {
            chart.options.scales.x.time.unit = 'second';
        } else if (rangeMinutes <= 60) {
            chart.options.scales.x.time.unit = 'minute';
        } else if (rangeMinutes <= 1440) {
            chart.options.scales.x.time.unit = 'hour';
        } else {
            chart.options.scales.x.time.unit = 'day';
        }
    } else {
        // ═══════════════════════════════════════════════════════════════════
        // STACKED MODE: Consecutive data without gaps
        // Use virtual timestamps so data appears consecutive
        // Axis shows the virtual time range
        // ═══════════════════════════════════════════════════════════════════
        chart.options.scales.x.min = minTime;
        chart.options.scales.x.max = maxTime;
        
        // Set appropriate time unit for stacked data
        const rangeMinutes = (maxTime - minTime) / 60000;
        if (rangeMinutes <= 60) {
            chart.options.scales.x.time.unit = 'minute';
        } else if (rangeMinutes <= 1440) {
            chart.options.scales.x.time.unit = 'hour';
        } else {
            chart.options.scales.x.time.unit = 'day';
        }
    }
    
    chart.update('none');
}

function updateStats(data) {
    if (data.length > 0) {
        const latest = data[data.length - 1];
        document.getElementById('statEventsMin').textContent = latest.ec || '--';
        document.getElementById('statMuonsMin').textContent = latest.cc || '--';
        document.getElementById('statSipmAvg').textContent = latest.sm ? `${latest.sm.toFixed(1)} mV` : '-- mV';
        document.getElementById('statTemp').textContent = latest.tp ? `${latest.tp.toFixed(1)} °C` : '-- °C';
        document.getElementById('statPressure').textContent = latest.pr ? `${(latest.pr/100).toFixed(1)} hPa` : '-- hPa';
        document.getElementById('statLastUpdate').textContent = new Date(latest.timestamp * 1000).toLocaleTimeString();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME AXIS UPDATE - Keeps axis moving in ACCURATE mode even without data
// ═══════════════════════════════════════════════════════════════════════════════
function startTimeAxisUpdate() {
    // Update every second to keep time axis current
    setInterval(() => {
        if (!isStackedMode) {
            // In ACCURATE mode, refresh to update axis bounds
            updateCharts();
        }
    }, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════
function setupEventListeners() {
    // Time range buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.dataset.range;
            
            if (range === 'custom') {
                // Show custom range picker
                showCustomRangePicker();
                return;
            }
            
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (range === 'all') {
                globalTimeRange = 'all';
            } else {
                globalTimeRange = parseInt(range);
            }
            localStorage.setItem('munra_range', globalTimeRange);
            updateCharts();
        });
    });
    
    // Mode switch (ACCURATE/STACKED)
    document.getElementById('modeSwitch').addEventListener('change', (e) => {
        isStackedMode = e.target.checked;
        localStorage.setItem('munra_stacked', isStackedMode);
        updateModeLabels();
        updateCharts();
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        isLightMode = !isLightMode;
        document.body.setAttribute('data-theme', isLightMode ? 'light' : '');
        localStorage.setItem('munra_theme', isLightMode ? 'light' : 'dark');
        document.querySelector('.sun-icon').style.display = isLightMode ? 'none' : 'block';
        document.querySelector('.moon-icon').style.display = isLightMode ? 'block' : 'none';
    });
    
    // Settings modal - use event delegation for reliability across different browsers/accounts
    document.addEventListener('click', (e) => {
        if (e.target.closest('#settingsBtn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Settings button clicked');
            // Update settings modal based on user role
            updateSettingsModalForUser();
            document.getElementById('settingsModal').classList.add('active');
            updateStorageStats();
        }
    });
    
    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('active');
    });
    
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            document.getElementById('settingsModal').classList.remove('active');
        }
    });
    
    // Language selector
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        // Set initial value
        const savedLang = localStorage.getItem('munra_language') || 'es';
        languageSelect.value = savedLang;
        
        languageSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('munra_language', newLang);
            if (typeof setLanguage === 'function') {
                setLanguage(newLang);
            }
            showToast(newLang === 'es' ? 'Idioma cambiado a Español' : 'Language changed to English', 'success');
        });
    }
    
    // Database choice selector for regular users
    const databaseChoice = document.getElementById('databaseChoice');
    if (databaseChoice) {
        databaseChoice.addEventListener('change', (e) => {
            const customUrlInput = document.getElementById('userCustomUrl');
            if (customUrlInput) {
                customUrlInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
        });
    }
    
    // Firebase Apply button (admin - inside adminDatabaseOptions)
    const applyFirebaseBtn = document.getElementById('applyFirebaseBtn');
    if (applyFirebaseBtn) {
        applyFirebaseBtn.addEventListener('click', applyFirebaseConfig);
    }
    
    // Firebase Apply button for users
    const applyFirebaseBtnUser = document.getElementById('applyFirebaseBtnUser');
    if (applyFirebaseBtnUser) {
        applyFirebaseBtnUser.addEventListener('click', applyFirebaseConfigUser);
    }
    
    // Migrate Database button (admin only)
    const migrateDbBtn = document.getElementById('migrateDbBtn');
    if (migrateDbBtn) {
        migrateDbBtn.addEventListener('click', showMigrateDbModal);
    }
    
    // Profile select
    document.getElementById('profileSelect').addEventListener('change', (e) => {
        currentProfile = e.target.value;
        localStorage.setItem('munra_profile', currentProfile);
        if (currentProfile) subscribeToProfile();
    });
    
    // Add Profile button
    document.getElementById('addProfileBtn').addEventListener('click', () => {
        showCreateProfileModal();
    });
    
    // Manage Profiles button
    document.getElementById('manageProfilesBtn').addEventListener('click', () => {
        showManageProfilesModal();
    });
    
    // Chart type buttons - MUST WORK
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const chartName = btn.dataset.chart;
            cycleChartType(chartName);
        });
    });
    
    // Download buttons - MUST WORK
    document.querySelectorAll('.chart-download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const chartName = btn.dataset.chart;
            downloadChartData(chartName);
        });
    });
    
    // Upload session
    document.getElementById('uploadSessionBtn').addEventListener('click', () => {
        document.getElementById('sessionFileInput').click();
    });
    
    document.getElementById('sessionFileInput').addEventListener('change', handleFileUpload);
    
    // Upload profile
    document.getElementById('uploadProfileBtn').addEventListener('click', () => {
        document.getElementById('profileFileInput').click();
    });
    
    document.getElementById('profileFileInput').addEventListener('change', handleProfileUpload);
    
    // Export data
    document.getElementById('exportDataBtn').addEventListener('click', exportAllData);
}

function updateModeLabels() {
    document.getElementById('accurateLabel').classList.toggle('active', !isStackedMode);
    document.getElementById('stackedLabel').classList.toggle('active', isStackedMode);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART TYPE CYCLING
// ═══════════════════════════════════════════════════════════════════════════════
function cycleChartType(chartName) {
    const types = ['line', 'bar', 'scatter'];
    const currentType = chartTypes[chartName];
    const nextIndex = (types.indexOf(currentType) + 1) % types.length;
    const newType = types[nextIndex];
    chartTypes[chartName] = newType;
    
    const chart = charts[chartName];
    if (chart) {
        chart.data.datasets.forEach(ds => {
            ds.type = newType;
            if (newType === 'scatter') {
                ds.pointRadius = 4;
                ds.showLine = false;
            } else if (newType === 'bar') {
                ds.pointRadius = 0;
            } else {
                ds.pointRadius = 2;
                ds.showLine = true;
            }
        });
        chart.update();
        showToast(`Chart type: ${newType}`, 'success');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD CHART DATA
// ═══════════════════════════════════════════════════════════════════════════════
function downloadChartData(chartName) {
    const chart = charts[chartName];
    if (!chart) return;
    
    let csv = 'Timestamp,DateTime';
    chart.data.datasets.forEach(ds => {
        csv += ',' + (ds.label || 'Value').replace(/,/g, ';');
    });
    csv += '\n';
    
    // Get all unique timestamps from all datasets
    const allTimestamps = new Set();
    chart.data.datasets.forEach(ds => {
        ds.data.forEach(point => {
            if (point && point.x) allTimestamps.add(point.x);
        });
    });
    
    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    sortedTimestamps.forEach(ts => {
        const date = new Date(ts);
        csv += `${ts},${date.toISOString()}`;
        chart.data.datasets.forEach(ds => {
            const point = ds.data.find(p => p && p.x === ts);
            csv += ',' + (point ? point.y : '');
        });
        csv += '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `munra_${chartName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast(`Downloaded ${chartName} data`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════
function updateSettingsModalForUser() {
    const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin();
    const isLogged = typeof isLoggedIn === 'function' && isLoggedIn();
    
    const databaseSettingGroup = document.getElementById('databaseSettingGroup');
    const userDatabaseOptions = document.getElementById('userDatabaseOptions');
    const adminDatabaseOptions = document.getElementById('adminDatabaseOptions');
    const dataManagementGroup = document.getElementById('dataManagementGroup');
    const applyBtnUser = document.getElementById('applyFirebaseBtnUser');
    const connectionResultUser = document.getElementById('connectionResultUser');
    
    if (isAdmin) {
        // Admin: show full URL input with warnings, hide regular options
        if (userDatabaseOptions) userDatabaseOptions.style.display = 'none';
        if (adminDatabaseOptions) adminDatabaseOptions.style.display = 'block';
        if (dataManagementGroup) dataManagementGroup.style.display = 'block';
        if (databaseSettingGroup) databaseSettingGroup.style.display = 'block';
        if (applyBtnUser) applyBtnUser.style.display = 'none';
        if (connectionResultUser) connectionResultUser.style.display = 'none';
    } else if (isLogged) {
        // Regular user: show choice (default/custom), hide admin URL
        if (userDatabaseOptions) userDatabaseOptions.style.display = 'block';
        if (adminDatabaseOptions) adminDatabaseOptions.style.display = 'none';
        if (dataManagementGroup) dataManagementGroup.style.display = 'block';
        if (databaseSettingGroup) databaseSettingGroup.style.display = 'block';
        if (applyBtnUser) applyBtnUser.style.display = 'block';
        if (connectionResultUser) connectionResultUser.style.display = 'block';
    } else {
        // Guest: hide database options and data management
        if (databaseSettingGroup) databaseSettingGroup.style.display = 'none';
        if (dataManagementGroup) dataManagementGroup.style.display = 'none';
    }
    
    // Load saved database URL
    const savedUrl = localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
    const firebaseUrlInput = document.getElementById('firebaseUrl');
    if (firebaseUrlInput) firebaseUrlInput.value = savedUrl;
    
    // For non-admin users, set the choice based on saved URL
    const databaseChoice = document.getElementById('databaseChoice');
    const userCustomUrl = document.getElementById('userCustomUrl');
    if (databaseChoice && userCustomUrl) {
        if (savedUrl === DEFAULT_FIREBASE_URL) {
            databaseChoice.value = 'default';
            userCustomUrl.style.display = 'none';
        } else {
            databaseChoice.value = 'custom';
            userCustomUrl.value = savedUrl;
            userCustomUrl.style.display = 'block';
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE
// ═══════════════════════════════════════════════════════════════════════════════
function applyFirebaseConfig() {
    const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin();
    const resultEl = document.getElementById('connectionResult');
    
    let url = '';
    
    if (isAdmin) {
        // Admin uses the direct URL input
        url = document.getElementById('firebaseUrl').value.trim();
    } else {
        // Regular users use the choice selector
        const choice = document.getElementById('databaseChoice')?.value;
        if (choice === 'default') {
            url = DEFAULT_FIREBASE_URL;
        } else {
            url = document.getElementById('userCustomUrl')?.value.trim();
        }
    }
    
    if (!url) {
        resultEl.textContent = 'Please enter a URL';
        resultEl.className = 'connection-result error';
        return;
    }
    
    resultEl.textContent = 'Connecting...';
    resultEl.className = 'connection-result';
    
    localStorage.setItem('munra_firebase_url', url);
    
    try {
        initFirebase(url);
        setTimeout(() => {
            if (db) {
                resultEl.textContent = '✓ Connected successfully!';
                resultEl.className = 'connection-result success';
                updateStorageStats();
            }
        }, 1000);
    } catch (e) {
        resultEl.textContent = '✗ Connection failed: ' + e.message;
        resultEl.className = 'connection-result error';
    }
}

// Apply Firebase config for regular users (simpler, uses choice selector)
function applyFirebaseConfigUser() {
    const resultEl = document.getElementById('connectionResultUser');
    const choice = document.getElementById('databaseChoice')?.value;
    
    let url = '';
    if (choice === 'default') {
        url = DEFAULT_FIREBASE_URL;
    } else {
        url = document.getElementById('userCustomUrl')?.value.trim();
    }
    
    if (!url) {
        resultEl.textContent = 'Please enter a URL';
        resultEl.className = 'connection-result error';
        return;
    }
    
    resultEl.textContent = 'Connecting...';
    resultEl.className = 'connection-result';
    
    localStorage.setItem('munra_firebase_url', url);
    
    try {
        initFirebase(url);
        setTimeout(() => {
            if (db) {
                resultEl.textContent = '✓ Connected successfully!';
                resultEl.className = 'connection-result success';
                updateStorageStats();
            }
        }, 1000);
    } catch (e) {
        resultEl.textContent = '✗ Connection failed: ' + e.message;
        resultEl.className = 'connection-result error';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE MIGRATION (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════
function showMigrateDbModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'migrateDbModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px;">
            <h2 style="margin-bottom: 10px; color: var(--text-primary);">🔄 Database Migration</h2>
            
            <div style="background: #f8d7da; border: 2px solid #f5c2c7; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h3 style="color: #842029; margin: 0 0 10px 0;">⚠️ CRITICAL OPERATION WARNING</h3>
                <p style="color: #842029; font-size: 13px; margin: 0;">
                    This operation will <strong>COPY ALL DATA</strong> from the current database to a new Firebase database.
                    This includes:
                </p>
                <ul style="color: #842029; font-size: 13px; margin: 10px 0;">
                    <li>All user accounts and settings</li>
                    <li>All profiles and their data</li>
                    <li>All session data and history</li>
                    <li>All realtime measurements</li>
                </ul>
                <p style="color: #842029; font-size: 13px; margin: 0;">
                    <strong>This process cannot be undone.</strong> Ensure you have the correct destination URL.
                </p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 14px;">
                    Source Database (current):
                </label>
                <input type="text" id="migrateSourceUrl" value="${localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL}" 
                       disabled style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-tertiary); color: var(--text-secondary); font-size: 12px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 14px;">
                    Destination Database URL:
                </label>
                <input type="text" id="migrateDestUrl" placeholder="https://new-database.firebaseio.com/" 
                       style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
            </div>
            
            <div id="migrateProgress" style="display: none; margin-bottom: 15px;">
                <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 15px;">
                    <p style="margin: 0 0 10px 0; color: var(--text-primary); font-weight: 500;">Migration Progress:</p>
                    <div style="background: var(--bg-secondary); border-radius: 4px; height: 20px; overflow: hidden;">
                        <div id="migrateProgressBar" style="background: linear-gradient(135deg, #00d4ff, #7b2cbf); height: 100%; width: 0%; transition: width 0.3s;"></div>
                    </div>
                    <p id="migrateStatus" style="margin: 10px 0 0 0; color: var(--text-secondary); font-size: 12px;">Preparing...</p>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeMigrateDbModal()" 
                        style="padding: 10px 20px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="startMigration()" id="startMigrateBtn"
                        style="padding: 10px 20px; border: none; border-radius: 8px; background: #dc3545; color: white; cursor: pointer; font-weight: 600;">
                    🚀 Start Migration
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeMigrateDbModal() {
    const modal = document.getElementById('migrateDbModal');
    if (modal) modal.remove();
}

async function startMigration() {
    const destUrl = document.getElementById('migrateDestUrl').value.trim();
    
    if (!destUrl) {
        showToast('Please enter a destination URL', 'error');
        return;
    }
    
    // Multiple confirmations
    if (!confirm('⚠️ FIRST CONFIRMATION:\n\nYou are about to migrate ALL data to:\n' + destUrl + '\n\nAre you sure you want to continue?')) {
        return;
    }
    
    if (!confirm('⚠️ SECOND CONFIRMATION:\n\nThis action CANNOT be undone. All data will be COPIED to the new database.\n\nProceed with migration?')) {
        return;
    }
    
    const finalConfirm = prompt('⚠️ FINAL CONFIRMATION:\n\nType "MIGRATE" to confirm you understand this operation:');
    if (finalConfirm !== 'MIGRATE') {
        showToast('Migration cancelled', 'info');
        return;
    }
    
    // Show progress
    document.getElementById('migrateProgress').style.display = 'block';
    document.getElementById('startMigrateBtn').disabled = true;
    
    const progressBar = document.getElementById('migrateProgressBar');
    const statusText = document.getElementById('migrateStatus');
    
    try {
        statusText.textContent = 'Connecting to source database...';
        progressBar.style.width = '5%';
        
        // Get all data from source
        const sourceData = await db.ref('/').once('value');
        const allData = sourceData.val() || {};
        
        statusText.textContent = 'Data retrieved. Preparing destination...';
        progressBar.style.width = '20%';
        
        // Initialize destination database
        const destConfig = {
            apiKey: "AIzaSyBEK9jPwoEuFRK_5HBTzZxaLYH3PrLW0xA",
            databaseURL: destUrl,
            projectId: "munra-1"
        };
        
        // Create temporary Firebase app for destination
        const destApp = firebase.initializeApp(destConfig, 'migrationDest');
        const destDb = destApp.database();
        
        statusText.textContent = 'Writing users data...';
        progressBar.style.width = '30%';
        
        if (allData.users) {
            await destDb.ref('users').set(allData.users);
        }
        
        statusText.textContent = 'Writing profiles data...';
        progressBar.style.width = '50%';
        
        if (allData.profiles) {
            await destDb.ref('profiles').set(allData.profiles);
        }
        
        statusText.textContent = 'Writing sessions data...';
        progressBar.style.width = '70%';
        
        // Copy other data
        for (const key of Object.keys(allData)) {
            if (key !== 'users' && key !== 'profiles') {
                statusText.textContent = `Writing ${key} data...`;
                await destDb.ref(key).set(allData[key]);
            }
        }
        
        progressBar.style.width = '90%';
        statusText.textContent = 'Cleaning up...';
        
        // Delete temporary app
        await destApp.delete();
        
        progressBar.style.width = '100%';
        statusText.textContent = '✅ Migration completed successfully!';
        statusText.style.color = '#2ea043';
        
        showToast('Migration completed successfully!', 'success');
        
        // Ask if user wants to switch to new database
        if (confirm('Migration complete! Would you like to switch to the new database now?')) {
            localStorage.setItem('munra_firebase_url', destUrl);
            location.reload();
        }
        
    } catch (e) {
        console.error('Migration error:', e);
        statusText.textContent = '❌ Migration failed: ' + e.message;
        statusText.style.color = '#dc3545';
        showToast('Migration failed: ' + e.message, 'error');
        document.getElementById('startMigrateBtn').disabled = false;
    }
}

function loadProfiles() {
    if (!db) return;
    
    db.ref('profiles').once('value').then(snapshot => {
        allProfiles = snapshot.val() || {};
        const select = document.getElementById('profileSelect');
        select.innerHTML = '<option value="">Select Profile</option>';
        
        // Filter profiles based on user access
        const accessibleProfiles = {};
        
        Object.keys(allProfiles).forEach(id => {
            const profile = allProfiles[id];
            
            // Check if user can access this profile
            if (typeof canAccessProfile === 'function' && !canAccessProfile(profile, id)) {
                return; // Skip this profile
            }
            
            accessibleProfiles[id] = profile;
            
            // Handle both structures: profile.name or profile.meta.name
            let name = id;
            if (profile.name) {
                name = profile.name;
            } else if (profile.meta && profile.meta.name) {
                name = profile.meta.name;
            }
            
            // Add visibility indicator
            const visIcon = profile.visibility === 'private' ? '🔒 ' : '';
            select.innerHTML += `<option value="${id}">${visIcon}${name}</option>`;
        });
        
        // Update allProfiles to only contain accessible ones for other functions
        // But keep the original for reference
        
        // Restore saved profile (only if accessible)
        const saved = localStorage.getItem('munra_profile');
        if (saved && accessibleProfiles[saved]) {
            currentProfile = saved;
            select.value = saved;
            subscribeToProfile();
        } else if (Object.keys(accessibleProfiles).length > 0) {
            currentProfile = Object.keys(accessibleProfiles)[0];
            select.value = currentProfile;
            subscribeToProfile();
        } else {
            currentProfile = '';
            // Clear charts if no profile accessible
        }
        
        setConnectionStatus('connected', 'Connected');
    }).catch(err => {
        console.error('Load profiles error:', err);
        setConnectionStatus('error', 'Error loading');
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE NEW PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
function showCreateProfileModal() {
    // Require login to create profiles
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
        showToast('You must be logged in to create profiles', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'createProfileModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px;">
            <h2 style="margin-bottom: 20px; color: var(--text-primary);">➕ Create New Profile</h2>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 14px;">Profile Name:</label>
                <input type="text" id="newProfileName" placeholder="e.g., COSMIC-2" 
                       style="width: 100%; padding: 10px; border: 1px solid var(--border-color); 
                              border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 14px;">Profile ID (optional):</label>
                <input type="text" id="newProfileId" placeholder="auto-generated from name" 
                       style="width: 100%; padding: 10px; border: 1px solid var(--border-color); 
                              border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
                <small style="color: var(--text-secondary); font-size: 11px;">Leave empty to auto-generate from name</small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 14px;">Visibility:</label>
                <select id="newProfileVisibility" 
                        style="width: 100%; padding: 10px; border: 1px solid var(--border-color); 
                               border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px;">
                    <option value="private" selected>🔒 Private (only you can see)</option>
                    <option value="public">🌍 Public (everyone can see)</option>
                </select>
            </div>
            
            <div id="createProfileStatus" style="margin-bottom: 15px; padding: 10px; border-radius: 8px; display: none;"></div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeCreateProfileModal()" 
                        style="padding: 10px 20px; border: 1px solid var(--border-color); 
                               border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button onclick="createNewProfile()" 
                        style="padding: 10px 20px; border: none; border-radius: 8px; 
                               background: linear-gradient(135deg, #00d4ff, #7b2cbf); color: white; cursor: pointer; font-weight: 600; font-size: 14px;">
                    Create Profile
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('newProfileName').focus();
}

function closeCreateProfileModal() {
    const modal = document.getElementById('createProfileModal');
    if (modal) modal.remove();
}

async function createNewProfile() {
    const nameInput = document.getElementById('newProfileName');
    const idInput = document.getElementById('newProfileId');
    const visibilitySelect = document.getElementById('newProfileVisibility');
    const statusDiv = document.getElementById('createProfileStatus');
    
    const name = nameInput.value.trim();
    if (!name) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#ff4444';
        statusDiv.style.color = 'white';
        statusDiv.textContent = '❌ Profile name is required';
        return;
    }
    
    // Generate ID from name if not provided
    let profileId = idInput.value.trim();
    if (!profileId) {
        profileId = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    }
    
    // Check if profile already exists
    if (allProfiles[profileId]) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#ff4444';
        statusDiv.style.color = 'white';
        statusDiv.textContent = '❌ A profile with this ID already exists';
        return;
    }
    
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#2196F3';
    statusDiv.style.color = 'white';
    statusDiv.textContent = '⏳ Creating profile...';
    
    try {
        const now = new Date().toISOString();
        
        // Get current user info for owner assignment
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const userData = typeof getCurrentUserData === 'function' ? getCurrentUserData() : null;
        
        // Get selected visibility (default to private)
        const visibility = visibilitySelect ? visibilitySelect.value : 'private';
        
        // Create profile in Firebase with owner info
        const profileData = {
            name: name,
            visibility: visibility,
            meta: {
                name: name,
                created_at: now,
                updated_at: now
            }
        };
        
        // Assign owner if user is logged in
        if (user) {
            profileData.ownerUid = user.uid;
            profileData.ownerEmail = user.email;
            profileData.ownerName = userData?.displayName || user.email;
        }
        
        await db.ref(`profiles/${profileId}`).set(profileData);
        
        statusDiv.style.background = '#4CAF50';
        statusDiv.textContent = '✅ Profile created successfully!';
        
        // Reload profiles and select the new one
        setTimeout(() => {
            closeCreateProfileModal();
            loadProfiles();
            setTimeout(() => {
                document.getElementById('profileSelect').value = profileId;
                currentProfile = profileId;
                localStorage.setItem('munra_profile', profileId);
                subscribeToProfile();
            }, 500);
        }, 1000);
        
    } catch (error) {
        console.error('Error creating profile:', error);
        statusDiv.style.background = '#ff4444';
        statusDiv.textContent = '❌ Error: ' + error.message;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGE PROFILES MODAL (delete/edit/share) - Only shows profiles user OWNS
// ═══════════════════════════════════════════════════════════════════════════════
function showManageProfilesModal() {
    // Don't show for non-logged users
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
        showToast('You must be logged in to manage profiles', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'manageProfilesModal';
    
    let profilesHtml = '';
    let ownedCount = 0;
    
    Object.keys(allProfiles).forEach(id => {
        const profile = allProfiles[id];
        
        // Only show profiles user OWNS (not just can edit)
        if (typeof isProfileOwner === 'function' && !isProfileOwner(profile, id)) {
            return;
        }
        
        ownedCount++;
        
        let name = id;
        if (profile.name) {
            name = profile.name;
        } else if (profile.meta && profile.meta.name) {
            name = profile.meta.name;
        }
        const isSelected = id === currentProfile;
        const visIcon = profile.visibility === 'private' ? '🔒' : '🌐';
        const currentVis = profile.visibility === 'private' ? 'Private' : 'Public';
        const newVis = profile.visibility === 'private' ? 'PUBLIC' : 'PRIVATE';
        const visButtonColor = profile.visibility === 'private' ? '#e5a00d' : '#2ea043'; // Yellow for going public (warning), green for going private (safe)
        
        // Count shared users
        const sharedCount = profile.sharedWith ? Object.keys(profile.sharedWith).length : 0;
        const sharedText = sharedCount > 0 ? ` | Shared with ${sharedCount}` : '';
        
        profilesHtml += `
            <div class="profile-item" style="background: var(--bg-tertiary); border-radius: 8px; border: 1px solid ${isSelected ? '#00d4ff' : 'var(--border-color)'}; margin-bottom: 12px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px;">
                    <div>
                        <div style="font-weight: 500; color: var(--text-primary);">${visIcon} ${name}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">ID: ${id} | Currently: <strong>${currentVis}</strong>${sharedText}</div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                        <button onclick="confirmVisibilityChange('${id}', '${profile.visibility || 'public'}')" 
                                style="padding: 6px 12px; border: none; border-radius: 6px; background: ${visButtonColor}; color: white; cursor: pointer; font-size: 11px; font-weight: 500;">
                            Change to ${newVis}
                        </button>
                        <button onclick="toggleSharePanel('${id}')" 
                                style="padding: 6px 12px; border: none; border-radius: 6px; background: #7b2cbf; color: white; cursor: pointer; font-size: 12px;">
                            👥 Share
                        </button>
                        <button onclick="deleteProfile('${id}', '${name.replace(/'/g, "\\'")}')" 
                                style="padding: 6px 12px; border: none; border-radius: 6px; background: #f85149; color: white; cursor: pointer; font-size: 12px;"
                                ${isSelected ? 'disabled title="Cannot delete selected profile"' : ''}>
                            🗑️
                        </button>
                    </div>
                </div>
                
                <!-- Share Panel (hidden by default) -->
                <div id="sharePanel_${id}" style="display: none; padding: 12px; border-top: 1px solid var(--border-color); background: var(--bg-secondary);">
                    <div style="margin-bottom: 10px;">
                        <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Invite user by email or username:</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="shareInput_${id}" placeholder="Enter email or username"
                                   style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px;">
                            <select id="shareAccess_${id}" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px;">
                                <option value="view">View Only</option>
                                <option value="edit">Can Edit</option>
                            </select>
                            <button onclick="shareProfileWith('${id}')" 
                                    style="padding: 8px 16px; border: none; border-radius: 6px; background: linear-gradient(135deg, #00d4ff, #7b2cbf); color: white; cursor: pointer; font-size: 13px; font-weight: 500;">
                                Invite
                            </button>
                        </div>
                    </div>
                    <div id="sharedList_${id}">
                        <!-- Shared users list will be populated here -->
                    </div>
                </div>
            </div>
        `;
    });
    
    if (ownedCount === 0) {
        profilesHtml = '<p style="color: var(--text-secondary); text-align: center;">You don\'t own any profiles yet. Create one to get started!</p>';
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px;">
            <h2 style="margin-bottom: 20px; color: var(--text-primary);">👤 Manage My Profiles</h2>
            
            <div style="max-height: 500px; overflow-y: auto; margin-bottom: 20px;">
                ${profilesHtml}
            </div>
            
            <div id="manageProfilesStatus" style="margin-bottom: 15px; padding: 10px; border-radius: 8px; display: none;"></div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeManageProfilesModal()" 
                        style="padding: 10px 20px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-tertiary); color: var(--text-primary); cursor: pointer; font-size: 14px;">
                    Close
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function toggleSharePanel(profileId) {
    const panel = document.getElementById(`sharePanel_${profileId}`);
    if (!panel) return;
    
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        loadSharedUsersList(profileId);
    } else {
        panel.style.display = 'none';
    }
}

async function loadSharedUsersList(profileId) {
    const listDiv = document.getElementById(`sharedList_${profileId}`);
    if (!listDiv) return;
    
    const profile = allProfiles[profileId];
    const sharedWith = profile?.sharedWith || {};
    
    if (Object.keys(sharedWith).length === 0) {
        listDiv.innerHTML = '<p style="color: var(--text-secondary); font-size: 12px; margin: 0;">No one has access yet</p>';
        return;
    }
    
    let html = '<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Shared with:</div>';
    
    for (const [uid, access] of Object.entries(sharedWith)) {
        try {
            const userSnap = await db.ref(`users/${uid}`).once('value');
            const user = userSnap.val();
            if (user) {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 4px;">
                        <span style="color: var(--text-primary); font-size: 13px;">${user.displayName || user.email}</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 11px; color: var(--text-secondary);">${access === 'edit' ? 'Can edit' : 'View only'}</span>
                            <button onclick="removeProfileShare('${profileId}', '${uid}')" 
                                    style="padding: 2px 6px; border: none; border-radius: 4px; background: #f85149; color: white; cursor: pointer; font-size: 11px;">
                                ✕
                            </button>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Error loading user:', e);
        }
    }
    
    listDiv.innerHTML = html;
}

async function shareProfileWith(profileId) {
    const input = document.getElementById(`shareInput_${profileId}`);
    const accessSelect = document.getElementById(`shareAccess_${profileId}`);
    
    if (!input || !accessSelect) return;
    
    const searchTerm = input.value.trim();
    const accessType = accessSelect.value;
    
    if (!searchTerm) {
        showToast('Enter an email or username', 'error');
        return;
    }
    
    try {
        // Search for user by email or displayName
        const usersSnap = await db.ref('users').once('value');
        const users = usersSnap.val() || {};
        
        let foundUid = null;
        let foundUser = null;
        
        for (const [uid, user] of Object.entries(users)) {
            if (user.email === searchTerm || user.displayName === searchTerm) {
                foundUid = uid;
                foundUser = user;
                break;
            }
        }
        
        if (!foundUid) {
            showToast('User not found. They must register first.', 'error');
            return;
        }
        
        // Add to sharedWith
        await db.ref(`profiles/${profileId}/sharedWith/${foundUid}`).set(accessType);
        
        // Update local cache
        if (!allProfiles[profileId].sharedWith) {
            allProfiles[profileId].sharedWith = {};
        }
        allProfiles[profileId].sharedWith[foundUid] = accessType;
        
        input.value = '';
        showToast(`Shared with ${foundUser.displayName || foundUser.email}`, 'success');
        
        // Refresh list
        loadSharedUsersList(profileId);
        
    } catch (e) {
        console.error('Error sharing profile:', e);
        showToast('Error sharing profile', 'error');
    }
}

async function removeProfileShare(profileId, uid) {
    try {
        await db.ref(`profiles/${profileId}/sharedWith/${uid}`).remove();
        
        // Update local cache
        if (allProfiles[profileId].sharedWith) {
            delete allProfiles[profileId].sharedWith[uid];
        }
        
        showToast('Access removed', 'success');
        loadSharedUsersList(profileId);
        
    } catch (e) {
        showToast('Error removing access', 'error');
    }
}

function closeManageProfilesModal() {
    const modal = document.getElementById('manageProfilesModal');
    if (modal) modal.remove();
}

// Confirm visibility change with proper warning
function confirmVisibilityChange(profileId, currentVisibility) {
    const profile = allProfiles[profileId];
    if (!profile) return;
    
    const newVisibility = currentVisibility === 'private' ? 'public' : 'private';
    const profileName = profile.name || profileId;
    
    // Different messages for public vs private
    let warningMessage;
    if (newVisibility === 'public') {
        warningMessage = `⚠️ WARNING: You are about to make "${profileName}" PUBLIC.\n\n` +
                        `This means:\n` +
                        `• ANYONE can view this profile\n` +
                        `• The data will be visible to all users\n` +
                        `• Search engines may index it\n\n` +
                        `Are you sure you want to make this profile PUBLIC?`;
    } else {
        warningMessage = `🔒 You are about to make "${profileName}" PRIVATE.\n\n` +
                        `This means:\n` +
                        `• Only you and people you share with can view it\n` +
                        `• Other users will no longer see this profile\n\n` +
                        `Proceed?`;
    }
    
    if (!confirm(warningMessage)) {
        return;
    }
    
    // Perform the change
    toggleProfileVisibility(profileId);
}

async function toggleProfileVisibility(profileId) {
    const profile = allProfiles[profileId];
    if (!profile) return;
    
    const newVisibility = profile.visibility === 'private' ? 'public' : 'private';
    
    try {
        await db.ref(`profiles/${profileId}/visibility`).set(newVisibility);
        allProfiles[profileId].visibility = newVisibility;
        showToast(`Profile is now ${newVisibility}`, 'success');
        
        // Refresh the modal
        closeManageProfilesModal();
        showManageProfilesModal();
    } catch (e) {
        showToast('Error changing visibility', 'error');
        console.error(e);
    }
}

async function deleteProfile(profileId, profileName) {
    if (!confirm(`Are you sure you want to delete profile "${profileName}" (${profileId})?\n\nThis will delete all data from Firebase. This cannot be undone!`)) {
        return;
    }
    
    const statusDiv = document.getElementById('manageProfilesStatus');
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#2196F3';
    statusDiv.style.color = 'white';
    statusDiv.textContent = '⏳ Deleting profile...';
    
    try {
        // Delete from Firebase
        await db.ref(`profiles/${profileId}`).remove();
        
        statusDiv.style.background = '#4CAF50';
        statusDiv.textContent = '✅ Profile deleted!';
        
        // If this was the current profile, clear selection
        if (currentProfile === profileId) {
            currentProfile = '';
            localStorage.removeItem('munra_profile');
            if (realtimeRef) {
                realtimeRef.off();
                realtimeRef = null;
            }
        }
        
        // Reload profiles
        setTimeout(() => {
            closeManageProfilesModal();
            loadProfiles();
        }, 1000);
        
    } catch (error) {
        console.error('Error deleting profile:', error);
        statusDiv.style.background = '#f85149';
        statusDiv.textContent = '❌ Error: ' + error.message;
    }
}

function subscribeToProfile() {
    if (!db || !currentProfile) return;
    
    // Unsubscribe previous
    if (realtimeRef) {
        realtimeRef.off();
        realtimeRef = null;
    }
    
    // Subscribe to latest
    db.ref(`profiles/${currentProfile}/latest`).on('value', snapshot => {
        latestData = snapshot.val();
        if (latestData) {
            updateLiveStats(latestData);
        }
    });
    
    // Subscribe to sessions
    db.ref(`profiles/${currentProfile}/sessions`).on('value', snapshot => {
        sessionsData = snapshot.val() || {};
        processAllData();
    });
    
    // Subscribe to realtime
    realtimeRef = db.ref(`profiles/${currentProfile}/realtime`);
    realtimeRef.orderByChild('ts').limitToLast(500).on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            realtimeData = Object.values(data).sort((a, b) => a.ts - b.ts);
        }
    });
}

function processAllData() {
    allData = [];
    Object.entries(sessionsData).forEach(([sessionId, session]) => {
        if (session.minutes) {
            Object.entries(session.minutes).forEach(([ts, data]) => {
                allData.push({ timestamp: parseInt(ts), session: sessionId, ...data });
            });
        }
    });
    allData.sort((a, b) => a.timestamp - b.timestamp);
    updateCharts();
    updateStorageStats();
}

function updateLiveStats(latest) {
    const now = Date.now() / 1000;
    const age = now - latest.ts;
    
    if (age < 120) {
        setConnectionStatus('connected', 'LIVE');
    } else if (age < 3600) {
        setConnectionStatus('connected', `${Math.floor(age/60)}m ago`);
    } else {
        setConnectionStatus('error', `${Math.floor(age/3600)}h ago`);
    }
}

function setConnectionStatus(status, text) {
    const indicator = document.getElementById('connectionStatus');
    indicator.className = 'status-indicator ' + status;
    indicator.querySelector('.status-text').textContent = text;
}

function updateStorageStats() {
    let totalMinutes = 0;
    Object.values(sessionsData).forEach(session => {
        if (session.minutes) {
            totalMinutes += Object.keys(session.minutes).length;
        }
    });
    
    document.getElementById('statsMinutes').textContent = totalMinutes.toLocaleString();
    document.getElementById('statsRealtime').textContent = realtimeData.length.toLocaleString();
    document.getElementById('statsConnection').textContent = db ? 'Active' : 'Not connected';
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD - Complete rewrite with progress tracking
// ═══════════════════════════════════════════════════════════════════════════════

let uploadModal = null;

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!db || !currentProfile) {
        showError('ERROR: Selecciona un perfil primero');
        return;
    }
    
    // Create and show progress modal
    showUploadProgress(file.name);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        await processUpload(event.target.result, file.name);
    };
    
    reader.onerror = () => {
        updateProgress('error', 'ERROR: No se pudo leer el archivo');
    };
    
    reader.readAsText(file);
    e.target.value = '';
}

function showUploadProgress(filename) {
    // Remove any existing modal
    if (uploadModal) uploadModal.remove();
    
    uploadModal = document.createElement('div');
    uploadModal.id = 'uploadProgressModal';
    uploadModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    uploadModal.innerHTML = `
        <div style="
            background: #1a1a2e;
            border: 2px solid #00d4ff;
            border-radius: 12px;
            padding: 30px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <h2 style="color: #00d4ff; margin: 0 0 20px 0; font-size: 18px;">
                📤 Procesando: ${filename}
            </h2>
            <div id="uploadSteps" style="font-family: monospace; font-size: 13px; line-height: 1.8;">
                <div class="step" data-step="read">⏳ Leyendo archivo...</div>
            </div>
            <div id="uploadProgressBar" style="
                margin-top: 20px;
                background: #2d2d44;
                border-radius: 6px;
                height: 24px;
                overflow: hidden;
            ">
                <div id="uploadProgressFill" style="
                    background: linear-gradient(90deg, #00d4ff, #00ff88);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    color: #1a1a2e;
                "></div>
            </div>
            <div id="uploadStatus" style="
                margin-top: 15px;
                padding: 10px;
                background: #2d2d44;
                border-radius: 6px;
                font-size: 12px;
                color: #8b949e;
                display: none;
            "></div>
            <button id="uploadCloseBtn" onclick="closeUploadModal()" style="
                display: none;
                margin-top: 20px;
                width: 100%;
                padding: 12px;
                background: #00d4ff;
                color: #1a1a2e;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
            ">Cerrar</button>
        </div>
    `;
    document.body.appendChild(uploadModal);
}

function addStep(icon, text, status = 'pending') {
    const stepsDiv = document.getElementById('uploadSteps');
    if (!stepsDiv) return;
    
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.style.color = status === 'error' ? '#ff4444' : (status === 'success' ? '#00ff88' : '#fff');
    stepDiv.innerHTML = `${icon} ${text}`;
    stepsDiv.appendChild(stepDiv);
    
    // Auto-scroll
    stepsDiv.scrollTop = stepsDiv.scrollHeight;
}

function updateProgress(percent, text) {
    const fill = document.getElementById('uploadProgressFill');
    if (fill) {
        fill.style.width = `${percent}%`;
        fill.textContent = `${percent}%`;
    }
}

function showUploadResult(success, message, details = null) {
    const stepsDiv = document.getElementById('uploadSteps');
    const statusDiv = document.getElementById('uploadStatus');
    const closeBtn = document.getElementById('uploadCloseBtn');
    const modal = document.getElementById('uploadProgressModal');
    
    if (stepsDiv) {
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            border-radius: 8px;
            background: ${success ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)'};
            border: 1px solid ${success ? '#00ff88' : '#ff4444'};
        `;
        resultDiv.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px;">${success ? '✅' : '❌'}</div>
            <div style="color: ${success ? '#00ff88' : '#ff4444'}; font-size: 14px; font-weight: bold;">
                ${message}
            </div>
        `;
        stepsDiv.appendChild(resultDiv);
    }
    
    if (details && statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = details;
    }
    
    if (closeBtn) {
        closeBtn.style.display = 'block';
        closeBtn.style.background = success ? '#00ff88' : '#ff4444';
    }
    
    // Change border color
    if (modal) {
        const inner = modal.querySelector('div');
        if (inner) {
            inner.style.borderColor = success ? '#00ff88' : '#ff4444';
        }
    }
}

function closeUploadModal() {
    if (uploadModal) {
        uploadModal.remove();
        uploadModal = null;
    }
}

async function processUpload(content, filename) {
    const lines = content.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const totalLines = lines.length;
    
    addStep('✅', `Archivo leído: ${totalLines.toLocaleString()} líneas`, 'success');
    updateProgress(10, '10%');
    
    // Small delay for UI update
    await new Promise(r => setTimeout(r, 100));
    
    // Detect format
    addStep('🔍', 'Detectando formato de datos...');
    
    const firstLine = lines[0].trim();
    const parts = firstLine.split(/\s+/);
    
    // Check if JSON
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        addStep('📋', 'Formato detectado: JSON');
        await processJSONUpload(content, filename);
        return;
    }
    
    // Check columns
    if (parts.length < 7) {
        showUploadResult(false, 'ERROR: Formato no reconocido', 
            `El archivo debe tener al menos 7 columnas.<br>Primera línea: "${firstLine.substring(0, 80)}..."`);
        return;
    }
    
    addStep('✅', `Formato detectado: Eventos MuNRa (${parts.length} columnas)`, 'success');
    updateProgress(15, '15%');
    
    // Extract date from filename
    let baseDate = null;
    const dateMatch = filename.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dateMatch) {
        const [_, day, month, year] = dateMatch;
        baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0);
        addStep('📅', `Fecha extraída del nombre: ${day}/${month}/${year}`, 'success');
    } else {
        baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0);
        addStep('⚠️', `No se encontró fecha en el nombre, usando hoy: ${baseDate.toLocaleDateString()}`, 'pending');
    }
    
    updateProgress(20, '20%');
    await new Promise(r => setTimeout(r, 100));
    
    // Parse all events and find timestamp range
    addStep('📊', 'Analizando rango de timestamps...');
    
    let minTs = Infinity, maxTs = -Infinity;
    let validEvents = 0;
    let invalidLines = 0;
    
    for (const line of lines) {
        const p = line.trim().split(/\s+/);
        if (p.length >= 2) {
            const ts = parseFloat(p[1]);
            if (!isNaN(ts)) {
                minTs = Math.min(minTs, ts);
                maxTs = Math.max(maxTs, ts);
                validEvents++;
            } else {
                invalidLines++;
            }
        }
    }
    
    if (validEvents === 0) {
        showUploadResult(false, 'ERROR: No se encontraron eventos válidos');
        return;
    }
    
    const tsRange = maxTs - minTs;
    addStep('✅', `Rango de timestamps: ${minTs.toLocaleString()} → ${maxTs.toLocaleString()}`, 'success');
    addStep('✅', `Eventos válidos: ${validEvents.toLocaleString()}`, 'success');
    if (invalidLines > 0) {
        addStep('⚠️', `Líneas ignoradas: ${invalidLines.toLocaleString()}`, 'pending');
    }
    
    updateProgress(30, '30%');
    await new Promise(r => setTimeout(r, 100));
    
    // Aggregate events by minute
    addStep('⚙️', 'Agregando eventos por minuto...');
    
    const baseTimestamp = Math.floor(baseDate.getTime() / 1000);
    const minuteData = {};
    let processedCount = 0;
    const updateInterval = Math.max(1, Math.floor(totalLines / 20)); // Update progress 20 times
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const p = line.trim().split(/\s+/);
        
        if (p.length < 7) continue;
        
        const relativeTs = parseFloat(p[1]);
        if (isNaN(relativeTs)) continue;
        
        // Convert relative timestamp to absolute
        // Assume timestamps are in milliseconds, normalize to the day
        const normalizedTs = tsRange > 0 ? (relativeTs - minTs) / tsRange : 0;
        const secondsInDay = normalizedTs * 86400; // Spread across 24 hours
        const absoluteTs = baseTimestamp + Math.floor(secondsInDay);
        const minuteTs = Math.floor(absoluteTs / 60) * 60;
        
        // Parse other columns
        const sipm = parseFloat(p[2]) || 0;
        const pressure = parseFloat(p[5]) || 0;
        const temp = parseFloat(p[6]) || 0;
        const deadtime = parseFloat(p[7]) || 0;
        
        if (!minuteData[minuteTs]) {
            minuteData[minuteTs] = {
                ts: minuteTs,
                ec: 0,
                cc: 0,
                sipmSum: 0,
                sipmMin: Infinity,
                sipmMax: -Infinity,
                tp: temp,
                pr: pressure,
                dtSum: 0
            };
        }
        
        const m = minuteData[minuteTs];
        m.ec++;
        m.cc++;
        m.sipmSum += sipm;
        m.sipmMin = Math.min(m.sipmMin, sipm);
        m.sipmMax = Math.max(m.sipmMax, sipm);
        m.tp = temp;
        m.pr = pressure;
        m.dtSum += deadtime;
        
        processedCount++;
        
        // Update progress
        if (i % updateInterval === 0) {
            const percent = 30 + Math.floor((i / totalLines) * 40);
            updateProgress(percent, `${percent}%`);
            await new Promise(r => setTimeout(r, 0)); // Allow UI update
        }
    }
    
    updateProgress(70, '70%');
    
    const minuteCount = Object.keys(minuteData).length;
    addStep('✅', `Agregación completada: ${processedCount.toLocaleString()} eventos → ${minuteCount.toLocaleString()} minutos`, 'success');
    
    await new Promise(r => setTimeout(r, 100));
    
    // Convert to final format
    addStep('🔄', 'Preparando datos para subir...');
    
    const data = Object.values(minuteData).map(m => ({
        ts: m.ts,
        ts_iso: new Date(m.ts * 1000).toISOString(),
        ec: m.ec,
        cc: m.cc,
        sm: m.ec > 0 ? Math.round(m.sipmSum / m.ec * 10) / 10 : 0,
        sn: m.sipmMin === Infinity ? 0 : m.sipmMin,
        sx: m.sipmMax === -Infinity ? 0 : m.sipmMax,
        tp: m.tp,
        pr: m.pr,
        dt: Math.round(m.dtSum)
    }));
    
    data.sort((a, b) => a.ts - b.ts);
    
    updateProgress(75, '75%');
    
    // Create session ID
    const firstTs = data[0].ts;
    const date = new Date(firstTs * 1000);
    const sessionId = date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0') + '_' +
        String(date.getHours()).padStart(2, '0') +
        String(date.getMinutes()).padStart(2, '0') +
        String(date.getSeconds()).padStart(2, '0');
    
    addStep('📁', `Session ID: ${sessionId}`);
    
    // Prepare minutes object
    const minutes = {};
    data.forEach(entry => {
        minutes[entry.ts.toString()] = entry;
    });
    
    updateProgress(80, '80%');
    
    // Upload to Firebase
    addStep('☁️', 'Subiendo a Firebase...');
    
    try {
        const sessionRef = db.ref(`profiles/${currentProfile}/sessions/${sessionId}`);
        
        await sessionRef.set({
            meta: {
                uploaded_at: new Date().toISOString(),
                source_file: filename,
                total_events: processedCount,
                total_minutes: minuteCount
            },
            minutes: minutes
        });
        
        updateProgress(90, '90%');
        addStep('✅', 'Datos subidos a Firebase', 'success');
        
        // Verify upload
        addStep('🔍', 'Verificando subida...');
        
        const verifySnapshot = await sessionRef.once('value');
        const verifyData = verifySnapshot.val();
        
        if (verifyData && verifyData.minutes) {
            const uploadedMinutes = Object.keys(verifyData.minutes).length;
            updateProgress(100, '100%');
            
            if (uploadedMinutes === minuteCount) {
                addStep('✅', `Verificación exitosa: ${uploadedMinutes} minutos en Firebase`, 'success');
                
                const firstDate = new Date(data[0].ts * 1000);
                const lastDate = new Date(data[data.length - 1].ts * 1000);
                
                showUploadResult(true, 'SUBIDA COMPLETADA EXITOSAMENTE', `
                    <strong>Resumen:</strong><br>
                    • Eventos procesados: ${processedCount.toLocaleString()}<br>
                    • Minutos creados: ${minuteCount.toLocaleString()}<br>
                    • Session ID: ${sessionId}<br>
                    • Rango: ${firstDate.toLocaleString()} → ${lastDate.toLocaleString()}<br>
                    • Archivo: ${filename}
                `);
            } else {
                addStep('⚠️', `Advertencia: Se subieron ${uploadedMinutes} de ${minuteCount} minutos`, 'pending');
                showUploadResult(true, 'SUBIDA PARCIAL', `Se verificaron ${uploadedMinutes} de ${minuteCount} minutos esperados.`);
            }
        } else {
            showUploadResult(false, 'ERROR: No se pudo verificar la subida', 'Los datos no aparecen en Firebase.');
        }
        
    } catch (uploadErr) {
        addStep('❌', `Error: ${uploadErr.message}`, 'error');
        showUploadResult(false, 'ERROR AL SUBIR', uploadErr.message);
    }
}

async function processJSONUpload(content, filename) {
    try {
        const json = JSON.parse(content);
        let data = [];
        
        if (json.minutes && typeof json.minutes === 'object') {
            data = Object.values(json.minutes);
            addStep('✅', `JSON con ${data.length} minutos`, 'success');
        } else if (Array.isArray(json)) {
            data = json;
            addStep('✅', `JSON array con ${data.length} entradas`, 'success');
        } else {
            data = [json];
        }
        
        if (data.length === 0) {
            showUploadResult(false, 'ERROR: JSON sin datos válidos');
            return;
        }
        
        // Continue with upload...
        updateProgress(50, '50%');
        
        // Ensure all entries have timestamps
        const validData = data.filter(d => d.ts || d.timestamp);
        validData.forEach(d => {
            if (!d.ts && d.timestamp) d.ts = d.timestamp;
        });
        
        if (validData.length === 0) {
            showUploadResult(false, 'ERROR: No hay entradas con timestamps válidos');
            return;
        }
        
        addStep('✅', `Entradas válidas: ${validData.length}`, 'success');
        
        // Create session and upload
        const firstTs = validData[0].ts;
        const date = new Date(firstTs * 1000);
        const sessionId = date.getFullYear().toString() +
            String(date.getMonth() + 1).padStart(2, '0') +
            String(date.getDate()).padStart(2, '0') + '_' +
            String(date.getHours()).padStart(2, '0') +
            String(date.getMinutes()).padStart(2, '0') +
            String(date.getSeconds()).padStart(2, '0');
        
        addStep('📁', `Session ID: ${sessionId}`);
        
        const minutes = {};
        validData.forEach(entry => {
            minutes[entry.ts.toString()] = entry;
        });
        
        updateProgress(70, '70%');
        addStep('☁️', 'Subiendo a Firebase...');
        
        const sessionRef = db.ref(`profiles/${currentProfile}/sessions/${sessionId}`);
        await sessionRef.set({
            meta: {
                uploaded_at: new Date().toISOString(),
                source_file: filename,
                total_minutes: validData.length
            },
            minutes: minutes
        });
        
        updateProgress(90, '90%');
        addStep('🔍', 'Verificando...');
        
        const verify = await sessionRef.once('value');
        if (verify.val() && verify.val().minutes) {
            updateProgress(100, '100%');
            addStep('✅', 'Verificación exitosa', 'success');
            showUploadResult(true, 'SUBIDA COMPLETADA', `${validData.length} minutos subidos como ${sessionId}`);
        } else {
            showUploadResult(false, 'ERROR: Verificación fallida');
        }
        
    } catch (err) {
        showUploadResult(false, 'ERROR AL PROCESAR JSON', err.message);
    }
}

// Show error prominently on screen  
function showError(message) {
    showToast(message, 'error');
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 2px solid #ff4444;
        border-radius: 12px;
        padding: 20px 30px;
        z-index: 10000;
        max-width: 80%;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    `;
    errorDiv.innerHTML = `
        <div style="color: #ff4444; font-size: 24px; margin-bottom: 10px;">⚠️ Error</div>
        <div style="color: #fff; font-size: 14px; margin-bottom: 20px;">${message}</div>
        <button onclick="this.parentElement.remove()" style="
            background: #ff4444;
            color: white;
            border: none;
            padding: 8px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        ">Cerrar</button>
    `;
    document.body.appendChild(errorDiv);
}

function parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= headers.length) {
            const entry = {};
            headers.forEach((h, idx) => {
                const val = values[idx]?.trim();
                entry[h] = isNaN(parseFloat(val)) ? val : parseFloat(val);
            });
            data.push(entry);
        }
    }
    return data;
}

// parseCustomFormat removed - replaced by parseMuNRaLogFormat

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE UPLOAD - Upload complete profile with multiple sessions
// ═══════════════════════════════════════════════════════════════════════════════

async function handleProfileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!db) {
        showError('ERROR: No hay conexión a Firebase');
        return;
    }
    
    // Check file type
    if (file.name.endsWith('.json')) {
        // JSON profile export
        const reader = new FileReader();
        reader.onload = async (event) => {
            await processProfileJSON(event.target.result, file.name);
        };
        reader.onerror = () => showError('ERROR: No se pudo leer el archivo');
        reader.readAsText(file);
    } else if (file.name.endsWith('.zip')) {
        showError('ZIP upload not yet implemented. Please use JSON format.');
    } else {
        showError('ERROR: Formato no soportado. Use JSON o ZIP.');
    }
    
    e.target.value = '';
}

async function processProfileJSON(content, filename) {
    showUploadProgress(filename);
    
    let profileData;
    try {
        profileData = JSON.parse(content);
        addStep('✅', 'JSON válido', 'success');
    } catch (err) {
        showUploadResult(false, 'ERROR: JSON inválido', err.message);
        return;
    }
    
    updateProgress(20, '20%');
    
    // Determine structure
    let profileId, profileContent;
    
    // Check if it's a single profile or multiple
    if (profileData.meta || profileData.sessions || profileData.name) {
        // Single profile format - ask for profile ID
        const inputId = prompt('Enter Profile ID for import:', 'imported_profile');
        if (!inputId) {
            closeUploadModal();
            return;
        }
        profileId = inputId.toLowerCase().replace(/[^a-z0-9]/g, '_');
        profileContent = profileData;
        addStep('📁', `Importing as profile: ${profileId}`, 'success');
    } else {
        // Multiple profiles format (like Firebase export)
        const profileKeys = Object.keys(profileData);
        addStep('📁', `Found ${profileKeys.length} profile(s) in file`, 'success');
        
        if (profileKeys.length === 1) {
            profileId = profileKeys[0];
            profileContent = profileData[profileId];
        } else {
            // Ask which profile to import
            const choice = prompt(`Multiple profiles found: ${profileKeys.join(', ')}\n\nEnter profile ID to import (or 'all' for all):`);
            if (!choice) {
                closeUploadModal();
                return;
            }
            
            if (choice.toLowerCase() === 'all') {
                // Import all profiles
                let totalSessions = 0;
                let totalMinutes = 0;
                
                for (const pid of profileKeys) {
                    addStep('📤', `Uploading profile: ${pid}...`);
                    try {
                        await db.ref(`profiles/${pid}`).set(profileData[pid]);
                        const sessions = profileData[pid].sessions || {};
                        const sessionCount = Object.keys(sessions).length;
                        const minuteCount = Object.values(sessions).reduce((sum, s) => 
                            sum + (s.minutes ? Object.keys(s.minutes).length : 0), 0);
                        totalSessions += sessionCount;
                        totalMinutes += minuteCount;
                        addStep('✅', `${pid}: ${sessionCount} sessions, ${minuteCount} minutes`, 'success');
                    } catch (err) {
                        addStep('❌', `${pid}: Error - ${err.message}`, 'error');
                    }
                }
                
                showUploadResult(true, 'Profiles imported successfully', 
                    `Imported ${profileKeys.length} profiles with ${totalSessions} sessions and ${totalMinutes} minutes total.`);
                loadProfiles();
                return;
            } else if (profileData[choice]) {
                profileId = choice;
                profileContent = profileData[choice];
            } else {
                showUploadResult(false, 'ERROR: Profile not found', `Profile "${choice}" not in file.`);
                return;
            }
        }
    }
    
    updateProgress(40, '40%');
    
    // Count what we're importing
    const sessions = profileContent.sessions || {};
    const sessionCount = Object.keys(sessions).length;
    let totalMinutes = 0;
    
    for (const [sessionId, sessionData] of Object.entries(sessions)) {
        if (sessionData.minutes) {
            totalMinutes += Object.keys(sessionData.minutes).length;
        }
    }
    
    addStep('📊', `Profile contains: ${sessionCount} sessions, ${totalMinutes} minutes`, 'success');
    updateProgress(50, '50%');
    
    // Check if profile already exists
    const existingRef = await db.ref(`profiles/${profileId}`).once('value');
    if (existingRef.val()) {
        const overwrite = confirm(`Profile "${profileId}" already exists. Overwrite?`);
        if (!overwrite) {
            closeUploadModal();
            return;
        }
        addStep('⚠️', 'Overwriting existing profile', 'pending');
    }
    
    // Upload to Firebase
    addStep('📤', 'Uploading to Firebase...');
    updateProgress(60, '60%');
    
    try {
        // Ensure profile has proper structure
        if (!profileContent.name && !profileContent.meta) {
            profileContent.name = profileId;
            profileContent.meta = {
                name: profileId,
                imported_at: new Date().toISOString()
            };
        }
        
        await db.ref(`profiles/${profileId}`).set(profileContent);
        updateProgress(90, '90%');
        
        // Verify
        addStep('🔍', 'Verifying upload...');
        const verifyRef = await db.ref(`profiles/${profileId}/sessions`).once('value');
        const verifiedSessions = verifyRef.val();
        const verifiedCount = verifiedSessions ? Object.keys(verifiedSessions).length : 0;
        
        updateProgress(100, '100%');
        
        showUploadResult(true, 'Profile imported successfully!', 
            `Profile: ${profileId}<br>Sessions: ${verifiedCount}<br>Minutes: ${totalMinutes.toLocaleString()}`);
        
        // Reload profiles and select the new one
        loadProfiles();
        setTimeout(() => {
            document.getElementById('profileSelect').value = profileId;
            currentProfile = profileId;
            localStorage.setItem('munra_profile', profileId);
            subscribeToProfile();
        }, 500);
        
    } catch (error) {
        console.error('Profile upload error:', error);
        showUploadResult(false, 'ERROR: Upload failed', error.message);
    }
}

function closeUploadModal() {
    if (uploadModal) {
        uploadModal.remove();
        uploadModal = null;
    }
}

function exportAllData() {
    if (allData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    let csv = 'Timestamp,DateTime,Session,Events,Muons,Temperature,Pressure,SiPM_Avg,SiPM_Min,SiPM_Max,DeadTime\n';
    
    allData.forEach(d => {
        const date = new Date(d.timestamp * 1000);
        csv += `${d.timestamp},${date.toISOString()},${d.session || ''},`;
        csv += `${d.ec||''},${d.cc||''},${d.tp||''},${d.pr||''},`;
        csv += `${d.sm||''},${d.sn||''},${d.sx||''},${d.dt||''}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `munra_export_${currentProfile}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM RANGE PICKER
// ═══════════════════════════════════════════════════════════════════════════════
function showCustomRangePicker() {
    const modal = document.getElementById('customRangeModal');
    modal.classList.add('active');
    
    // Set defaults based on data range
    if (allData.length > 0) {
        const firstTs = allData[0].timestamp * 1000;
        const lastTs = allData[allData.length - 1].timestamp * 1000;
        
        document.getElementById('customStartTime').value = new Date(firstTs).toISOString().slice(0, 16);
        document.getElementById('customEndTime').value = new Date(lastTs).toISOString().slice(0, 16);
    } else {
        const now = new Date();
        const hourAgo = new Date(now - 3600000);
        document.getElementById('customStartTime').value = hourAgo.toISOString().slice(0, 16);
        document.getElementById('customEndTime').value = now.toISOString().slice(0, 16);
    }
}

function setupCustomRangeListeners() {
    // Close custom range modal
    document.getElementById('closeCustomRange').addEventListener('click', () => {
        document.getElementById('customRangeModal').classList.remove('active');
    });
    
    // Apply custom range
    document.getElementById('applyCustomRange').addEventListener('click', () => {
        const startInput = document.getElementById('customStartTime').value;
        const endInput = document.getElementById('customEndTime').value;
        
        if (!startInput || !endInput) {
            showToast('Please select both start and end times', 'error');
            return;
        }
        
        customTimeStart = new Date(startInput).getTime();
        customTimeEnd = new Date(endInput).getTime();
        
        if (customTimeStart >= customTimeEnd) {
            showToast('Start time must be before end time', 'error');
            return;
        }
        
        globalTimeRange = 'custom';
        localStorage.setItem('munra_range', 'custom');
        
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.time-btn[data-range="custom"]').classList.add('active');
        
        document.getElementById('customRangeModal').classList.remove('active');
        updateCharts();
        
        showToast('Custom range applied', 'success');
    });
    
    // Close on outside click
    document.getElementById('customRangeModal').addEventListener('click', (e) => {
        if (e.target.id === 'customRangeModal') {
            document.getElementById('customRangeModal').classList.remove('active');
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
