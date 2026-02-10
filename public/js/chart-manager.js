/**
 * MunHub 5.0 — Chart Manager (slot-based)
 *
 * 4 chart SLOTS — each can display any data source.
 * Supports: line, line-only, smooth, smooth-no-dots, bar, scatter types.
 * Color management, chart info, customization controls.
 *
 * Depends on: config.js, data-manager.js
 */

const ChartManager = (() => {
    // ─── State ──────────────────────────────────────────────────────────
    const NUM_SLOTS = 4;

    /** @type {Chart[]} slot-indexed */
    const _charts = new Array(NUM_SLOTS);

    /** Stacked mode: maps point index → real timestamp (ms) for tick labels */
    let _stackedRealTimes = [];

    /** source key per slot: 'events' | 'sipm' | 'temp' | 'deadtime' | 'terminal' */
    const _slotSource = ['events', 'sipm', 'temp', 'deadtime'];

    let _globalTimeRange = 15;
    let _customTimeStart = null;
    let _customTimeEnd   = null;
    let _isStackedMode   = false;

    /** Chart type PER SLOT (not per source) */
    const _chartTypes = ['line', 'line', 'line', 'line'];

    /** For 5m view: separate chart type for the realtime overlay line, PER SLOT */
    const _realtimeChartTypes = ['bar', 'bar', 'bar', 'bar'];

    // RAF throttle
    let _updateScheduled = false;
    let _lastUpdateTs = 0;
    let _axisTimerId = null;

    // ─── Source display names ───────────────────────────────────────────
    const SOURCE_LABELS = {
        events:   'Event Rate',
        sipm:     'SiPM Signal',
        temp:     'Temperature & Pressure',
        deadtime: 'Dead Time',
        terminal: 'Terminal'
    };

    // ─── Accessors / Mutators ───────────────────────────────────────────
    function getTimeRange()   { return _globalTimeRange; }
    function isStacked()      { return _isStackedMode; }

    function setTimeRange(range) {
        // 1m and 5m require fresh realtime data (within last 5 minutes)
        if ((range === 1 || range === 5)) {
            if (!DataManager.hasRealtimeData()) {
                UIManager.showToast('1m/5m views require real-time data. Enable it when connecting a detector.', 'error');
                return;
            }
            if (DataManager.isRealtimeExpired && DataManager.isRealtimeExpired()) {
                UIManager.showToast('Real-time data is stale (>5 min old). Reconnect the detector to use 1m/5m views.', 'error');
                return;
            }
        }
        const wasRtRange = (_globalTimeRange === 5);
        _globalTimeRange = range;
        localStorage.setItem('munra_range', range);
        // Clean up realtime overlay datasets when leaving 5m view
        if (wasRtRange && range !== 5) _cleanupRealtimeOverlays();
        // Restart axis timer with appropriate interval for this range
        _startAxisTimer();
        scheduleUpdate();
    }
    function setCustomRange(start, end) {
        _customTimeStart = start;
        _customTimeEnd   = end;
        _globalTimeRange = 'custom';
        localStorage.setItem('munra_range', 'custom');
        scheduleUpdate();
    }
    function setStackedMode(on) {
        _isStackedMode = on;
        localStorage.setItem('munra_stacked', on);
        scheduleUpdate();
    }

    // ─── Larger Font constants ──────────────────────────────────────────
    const TICK_SIZE   = 12;
    const LEGEND_SIZE = 12;
    const AXIS_SIZE   = 12;

    // ─── Init ───────────────────────────────────────────────────────────
    function init() {
        _loadPreferences();

        // NOTE: Do NOT set Chart.defaults.elements.point.radius = 0 here.
        // Global defaults interfere with dataset-level pointRadius settings.
        // Instead, _styleDatasetForType() fully controls point visibility per type.

        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            _createChartForSlot(slot);
        }

        // Set global type button labels to match the current (saved) type
        const globalBtn = document.getElementById('globalTypeBtn');
        if (globalBtn) {
            const curType = _chartTypes[0] || 'line';
            globalBtn.textContent = CHART_TYPE_LABELS[curType] || curType;
        }
        const globalRtBtn = document.getElementById('globalRtTypeBtn');
        if (globalRtBtn) {
            const curRtType = _realtimeChartTypes[0] || 'bar';
            globalRtBtn.textContent = 'RT: ' + (CHART_TYPE_LABELS[curRtType] || curRtType);
        }

        _startAxisTimer();
    }

    function _createChartForSlot(slot) {
        const source = _slotSource[slot];
        if (source === 'terminal') return;        // no chart needed

        const canvas = document.getElementById(`chartCanvas${slot}`);
        if (!canvas) return;

        // Destroy any existing chart on this canvas
        if (_charts[slot]) { _charts[slot].destroy(); _charts[slot] = null; }

        const tooltipCallbacks = {
            title(ctx) {
                if (ctx[0]?.raw?.realTime) return new Date(ctx[0].raw.realTime).toLocaleString();
                return new Date(ctx[0].parsed.x).toLocaleString();
            }
        };

        const commonOpts = (yLabel = '') => ({
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 0 },
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true, position: 'top',
                    labels: { boxWidth: 12, padding: 8, font: { size: LEGEND_SIZE }, color: COLORS.tick }
                },
                tooltip: { callbacks: tooltipCallbacks }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'minute', displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm', day: 'MMM d' } },
                    ticks: { color: COLORS.tick, font: { size: TICK_SIZE }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    grid: { color: COLORS.grid }
                },
                y: {
                    ticks: { color: COLORS.tick, font: { size: TICK_SIZE } },
                    grid: { color: COLORS.grid },
                    title: yLabel ? { display: true, text: yLabel, color: COLORS.tick, font: { size: AXIS_SIZE } } : {}
                }
            }
        });

        const ds = (label, color, extra = {}) => {
            // Convert hex to rgba for backgroundColor
            let bg = color;
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1,3), 16), g = parseInt(color.slice(3,5), 16), b = parseInt(color.slice(5,7), 16);
                bg = `rgba(${r},${g},${b},0.5)`;
            } else if (color.includes('rgb')) {
                bg = color.replace(')', ',0.5)').replace('rgb', 'rgba');
            }
            return {
                label, data: [], borderColor: color,
                backgroundColor: bg,
                pointBackgroundColor: color,
                pointBorderColor: color,
                tension: 0, borderWidth: 1.5, fill: false, spanGaps: false,
                pointRadius: 0, pointStyle: false, pointHoverRadius: 0, pointHitRadius: 0,
                maxBarThickness: 40, minBarLength: 2,
                ...extra
            };
        };

        let config;
        switch (source) {
            case 'events':
                config = {
                    type: 'line',
                    data: { datasets: [ds('Events/min', COLORS.events), ds('Muons/min', COLORS.muons)] },
                    options: commonOpts()
                };
                break;
            case 'sipm':
                config = {
                    type: 'line',
                    data: { datasets: [
                        ds('Avg mV', COLORS.sipmAvg),
                        ds('Max mV', COLORS.sipmMax, { borderWidth: 1, borderDash: [3, 2] }),
                        ds('Min mV', COLORS.sipmMin, { borderWidth: 1, borderDash: [3, 2] })
                    ]},
                    options: commonOpts('mV')
                };
                break;
            case 'temp':
                config = {
                    type: 'line',
                    data: { datasets: [
                        ds('°C', COLORS.temp, { yAxisID: 'y' }),
                        ds('hPa', COLORS.pressure, { yAxisID: 'y1' })
                    ]},
                    options: {
                        ...commonOpts(),
                        scales: {
                            ...commonOpts().scales,
                            y:  { type: 'linear', position: 'left',  ticks: { color: COLORS.temp,     font: { size: TICK_SIZE } }, grid: { color: COLORS.grid }, title: { display: true, text: '°C',  color: COLORS.temp,     font: { size: AXIS_SIZE } } },
                            y1: { type: 'linear', position: 'right', ticks: { color: COLORS.pressure, font: { size: TICK_SIZE } }, grid: { display: false },     title: { display: true, text: 'hPa', color: COLORS.pressure, font: { size: AXIS_SIZE } } }
                        }
                    }
                };
                break;
            case 'deadtime':
            default:
                config = {
                    type: 'line',
                    data: { datasets: [ds('Dead Time %', COLORS.deadtime)] },
                    options: commonOpts('%')
                };
                break;
        }

        // Apply chart type styling BEFORE creating the Chart instance.
        // This ensures Chart.js resolves pointRadius/pointStyle from the
        // dataset config at construction time — not patched after.
        const savedType = _chartTypes[slot] || 'line';
        config.data.datasets.forEach(d => _styleDatasetForType(d, savedType));

        _charts[slot] = new Chart(canvas, config);
    }

    // ─── Source switching ────────────────────────────────────────────────
    function setSlotSource(slot, source) {
        if (slot < 0 || slot >= NUM_SLOTS) return;
        _slotSource[slot] = source;
        localStorage.setItem(`munra_slot${slot}_source`, source);

        const panel = document.getElementById(`chartPanel${slot}`);
        if (!panel) return;

        panel.dataset.source = source;

        // Update title
        const titleEl = panel.querySelector('.chart-title');
        if (titleEl) titleEl.textContent = SOURCE_LABELS[source] || source;

        // Terminal mode: hide canvas, show terminal div
        const container = panel.querySelector('.chart-container');
        const canvas    = document.getElementById(`chartCanvas${slot}`);

        if (source === 'terminal') {
            if (_charts[slot]) { _charts[slot].destroy(); _charts[slot] = null; }
            if (canvas) canvas.style.display = 'none';

            // Create terminal container if missing
            let termDiv = panel.querySelector('.chart-terminal');
            if (!termDiv) {
                termDiv = document.createElement('div');
                termDiv.className = 'chart-terminal';
                termDiv.id = `chartTerminal${slot}`;
                termDiv.innerHTML = '<div class="term-line term-system">Terminal ready — connect a detector to start.</div>';
                container.appendChild(termDiv);
            }
            termDiv.style.display = '';

            // Hide type/download buttons (not relevant for terminal)
            panel.querySelectorAll('.chart-type-btn, .chart-rt-type-btn, .chart-download-btn').forEach(b => b.style.display = 'none');
        } else {
            // Show canvas, hide terminal
            if (canvas) canvas.style.display = '';
            const termDiv = panel.querySelector('.chart-terminal');
            if (termDiv) termDiv.style.display = 'none';
            panel.querySelectorAll('.chart-type-btn, .chart-download-btn').forEach(b => b.style.display = '');

            _createChartForSlot(slot);
            scheduleUpdate();
        }
    }

    /** Get the slot index that is currently showing 'terminal', or -1 */
    function getTerminalSlot() {
        return _slotSource.indexOf('terminal');
    }

    /** Append a line to the terminal in whichever slot has source='terminal' */
    function appendTerminalLine(html) {
        const slot = getTerminalSlot();
        if (slot < 0) return;
        const termDiv = document.getElementById(`chartTerminal${slot}`);
        if (!termDiv) return;
        const line = document.createElement('div');
        line.className = 'term-line';
        line.innerHTML = html;
        termDiv.appendChild(line);
        termDiv.scrollTop = termDiv.scrollHeight;
        // Keep reasonable length
        while (termDiv.children.length > 500) termDiv.removeChild(termDiv.firstChild);
    }

    // ─── Preferences ────────────────────────────────────────────────────
    function _loadPreferences() {
        _isStackedMode = localStorage.getItem('munra_stacked') === 'true';
        const saved = localStorage.getItem('munra_range');
        _globalTimeRange = saved === 'all' || saved === 'custom' ? saved : (parseInt(saved) || 15);

        for (let s = 0; s < NUM_SLOTS; s++) {
            const src = localStorage.getItem(`munra_slot${s}_source`);
            if (src) _slotSource[s] = src;
            const ct = localStorage.getItem(`munra_slot${s}_chartType`);
            if (ct) _chartTypes[s] = ct;
            const rct = localStorage.getItem(`munra_slot${s}_rtChartType`);
            if (rct) _realtimeChartTypes[s] = rct;
        }
    }

    function _applySavedChartType(slot) {
        const type = _chartTypes[slot] || 'line';
        _applyChartType(slot, type, true);
    }

    // ─── Throttled Update ───────────────────────────────────────────────
    function scheduleUpdate() {
        if (_updateScheduled) return;
        const elapsed = performance.now() - _lastUpdateTs;
        // Use faster throttle for realtime views (1m/5m) so charts respond instantly
        const throttleMs = (_globalTimeRange === 1 || _globalTimeRange === 5) ? 300 : PERF.CHART_THROTTLE_MS;
        if (elapsed < throttleMs) {
            _updateScheduled = true;
            setTimeout(() => { _updateScheduled = false; requestAnimationFrame(_updateCharts); }, throttleMs - elapsed);
        } else {
            _updateScheduled = true;
            requestAnimationFrame(() => { _updateScheduled = false; _updateCharts(); });
        }
    }

    // ─── Core Render ────────────────────────────────────────────────────
    function _updateCharts() {
        _lastUpdateTs = performance.now();

        const isRtRange = (_globalTimeRange === 1 || _globalTimeRange === 5);

        // For 1m view: ONLY realtime data, no minute data
        if (_globalTimeRange === 1) {
            _renderRealtimeOnly();
            return;
        }

        const allData = DataManager.getAllData();
        if (!allData.length && !_isStackedMode && !isRtRange) return;

        const now = Date.now();
        let minTime, maxTime, filtered;

        if (_globalTimeRange === 'all') {
            filtered = allData;
            if (filtered.length) { minTime = filtered[0].timestamp * 1000; maxTime = filtered[filtered.length - 1].timestamp * 1000; }
            else { minTime = now - 15 * 60_000; maxTime = now; }
        } else if (_globalTimeRange === 'custom' && _customTimeStart && _customTimeEnd) {
            minTime = _customTimeStart; maxTime = _customTimeEnd;
            const bufferMs = PERF.CHART_EDGE_BUFFER_MS || 120_000;
            filtered = allData.filter(d => { const ts = d.timestamp * 1000; return ts >= (minTime - bufferMs) && ts <= (maxTime + bufferMs); });
        } else {
            const rangeMs = (typeof _globalTimeRange === 'number' ? _globalTimeRange : 15) * 60_000;
            if (_isStackedMode) {
                const wanted = typeof _globalTimeRange === 'number' ? _globalTimeRange : 15;
                filtered = allData.slice(-wanted);
                if (filtered.length) { minTime = filtered[0].timestamp * 1000; maxTime = filtered[filtered.length - 1].timestamp * 1000; }
                else { minTime = now - rangeMs; maxTime = now; }
            } else {
                minTime = now - rangeMs; maxTime = now;
                // Include buffer points beyond visible range so lines extend to chart edges.
                // Chart.js clips rendering at axis min/max, so extra points create edge continuity.
                const bufferMs = PERF.CHART_EDGE_BUFFER_MS || 120_000;
                filtered = allData.filter(d => {
                    const ts = d.timestamp * 1000;
                    return ts >= (minTime - bufferMs) && ts <= (maxTime + bufferMs);
                });
            }
        }

        // STACKED mode: pack data sequentially (no temporal gaps)
        // X axis uses indices, tick labels show REAL timestamps.
        let chartData = filtered;
        let cMin = minTime, cMax = maxTime;
        if (_isStackedMode && filtered.length) {
            // Build index-based X values so points are evenly spaced
            // Store real timestamps for tick labels and tooltips
            _stackedRealTimes = new Array(filtered.length);
            chartData = new Array(filtered.length);
            for (let i = 0; i < filtered.length; i++) {
                const d = filtered[i];
                _stackedRealTimes[i] = d.timestamp * 1000;
                // Use fake evenly-spaced timestamp: 1 per minute from a fixed base
                chartData[i] = {
                    timestamp: i,   // index, getX will multiply by 1000
                    ec: d.ec, cc: d.cc, sm: d.sm, sn: d.sn, sx: d.sx,
                    tp: d.tp, pr: d.pr, dt: d.dt,
                    realTime: d.timestamp * 1000
                };
            }
            cMin = 0;
            cMax = (filtered.length - 1) * 1000;  // getX = index * 1000
        } else {
            _stackedRealTimes = [];
        }

        // ACCURATE gap insertion
        if (!_isStackedMode && chartData.length > 1) {
            const withGaps = [];
            for (let i = 0; i < chartData.length; i++) {
                withGaps.push(chartData[i]);
                if (i < chartData.length - 1) {
                    const gap = (chartData[i + 1].timestamp - chartData[i].timestamp) * 1000;
                    if (gap > GAP_THRESHOLD_MS) withGaps.push({ timestamp: chartData[i].timestamp + 1, isGap: true });
                }
            }
            chartData = withGaps;
        }

        // Downsample
        if (chartData.length > PERF.MAX_CHART_POINTS) chartData = DataManager.downsample(chartData, PERF.MAX_CHART_POINTS);

        // Build point arrays for minute averages
        const getX = d => d.timestamp * 1000;
        const pt  = (d, f) => ({ x: getX(d), y: d.isGap ? null : (d[f] || 0),   realTime: d.timestamp * 1000 });
        const ptN = (d, f) => ({ x: getX(d), y: d.isGap ? null : (d[f] || null), realTime: d.timestamp * 1000 });
        const ptP = d       => ({ x: getX(d), y: d.isGap ? null : (d.pr ? d.pr / 100 : null), realTime: d.timestamp * 1000 });

        const len = chartData.length;
        const arrays = {
            ev: new Array(len), mu: new Array(len),
            sa: new Array(len), sx: new Array(len), sn: new Array(len),
            tp: new Array(len), pr: new Array(len),
            dt: new Array(len)
        };
        for (let i = 0; i < len; i++) {
            const d = chartData[i];
            arrays.ev[i] = pt(d, 'ec');  arrays.mu[i] = pt(d, 'cc');
            arrays.sa[i] = pt(d, 'sm');  arrays.sx[i] = pt(d, 'sx'); arrays.sn[i] = pt(d, 'sn');
            arrays.tp[i] = ptN(d, 'tp'); arrays.pr[i] = ptP(d);
            arrays.dt[i] = ptN(d, 'dt');
        }

        // For 5m view: also build realtime point arrays
        let rtArrays = null;
        if (_globalTimeRange === 5) {
            rtArrays = _buildRealtimeArrays(cMin, cMax);
            _updateRtTypeButtons(true);
        } else {
            _updateRtTypeButtons(false);
        }

        // Push data to each slot's chart (skip terminal slots)
        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            if (!_charts[slot]) continue;
            const src = _slotSource[slot];
            let datasets;
            switch (src) {
                case 'events':   datasets = [arrays.ev, arrays.mu]; break;
                case 'sipm':     datasets = [arrays.sa, arrays.sx, arrays.sn]; break;
                case 'temp':     datasets = [arrays.tp, arrays.pr]; break;
                case 'deadtime': datasets = [arrays.dt]; break;
                default: continue;
            }

            // 5m view: append realtime overlay datasets after the minute datasets
            if (_globalTimeRange === 5 && rtArrays) {
                const rtData = _getRealtimeDatasetsForSource(src, rtArrays);
                if (rtData.length > 0) {
                    _ensureRealtimeDatasets(slot, src, rtData.length);
                    datasets = datasets.concat(rtData);
                }
            }

            _setChart(_charts[slot], datasets, cMin, cMax);
        }

        _updateStats(filtered);
    }

    /** Build point arrays from realtime data within a time range */
    function _buildRealtimeArrays(minTime, maxTime) {
        const rtRaw = DataManager.getRealtimeData();
        if (!rtRaw.length) return null;

        // Include buffer beyond visible range for edge line continuity
        const bufferMs = PERF.CHART_EDGE_BUFFER_MS || 120_000;
        const filtered = rtRaw.filter(d => d.ts >= (minTime - bufferMs) && d.ts <= (maxTime + bufferMs));
        if (!filtered.length) return null;

        const len = filtered.length;

        // ── Event Rate: aggregate by second (count events & muons per second) ──
        const evBuckets = _bucketEventsBySecond(filtered);

        const arrays = {
            ev: evBuckets.ev, mu: evBuckets.mu,
            sa: new Array(len),
            tp: new Array(len), pr: new Array(len),
            dt: new Array(len)
        };
        for (let i = 0; i < len; i++) {
            const d = filtered[i];
            arrays.sa[i] = { x: d.ts, y: d.sipm || 0 };                           // instantaneous SiPM
            arrays.tp[i] = { x: d.ts, y: d.temp != null ? d.temp : null };         // instantaneous temp
            arrays.pr[i] = { x: d.ts, y: d.pressure != null ? d.pressure / 100 : null }; // Pa→hPa
            arrays.dt[i] = { x: d.ts, y: d.deadtime != null ? d.deadtime : null }; // instantaneous deadtime
        }
        return arrays;
    }

    /**
     * Bucket events by second: count total events and muon coincidences per second.
     * Returns { ev: [{x, y}...], mu: [{x, y}...] } where y = count/second.
     */
    function _bucketEventsBySecond(data) {
        const evMap = new Map();   // secondTs → count
        const muMap = new Map();   // secondTs → count

        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const sec = Math.floor(d.ts / 1000) * 1000;  // bucket to nearest second
            evMap.set(sec, (evMap.get(sec) || 0) + 1);
            if (d.coincident) muMap.set(sec, (muMap.get(sec) || 0) + 1);
        }

        // Convert to sorted arrays
        const evKeys = [...evMap.keys()].sort((a, b) => a - b);
        const ev = evKeys.map(k => ({ x: k, y: evMap.get(k) }));
        const mu = evKeys.map(k => ({ x: k, y: muMap.get(k) || 0 }));

        return { ev, mu };
    }

    /** Get realtime data arrays for a specific chart source */
    function _getRealtimeDatasetsForSource(src, rtArrays) {
        if (!rtArrays) return [];
        switch (src) {
            case 'events':   return [rtArrays.ev, rtArrays.mu];
            case 'sipm':     return [rtArrays.sa];
            case 'temp':     return [rtArrays.tp, rtArrays.pr];
            case 'deadtime': return [rtArrays.dt];
            default: return [];
        }
    }

    /** Ensure the chart has enough datasets for both minute + realtime data */
    function _ensureRealtimeDatasets(slot, src, rtCount) {
        const chart = _charts[slot];
        if (!chart) return;

        // Calculate expected total: minute datasets + realtime datasets
        const minuteCount = _getMinuteDatasetCount(src);
        const totalNeeded = minuteCount + rtCount;
        const rtType = _realtimeChartTypes[slot] || 'scatter';

        // Add missing realtime datasets if needed
        while (chart.data.datasets.length < totalNeeded) {
            const rtIdx = chart.data.datasets.length - minuteCount;
            const rtLabel = _getRealtimeLabel(src, rtIdx);
            const rtColor = _getRealtimeColor(src, rtIdx);

            const ds = {
                label: rtLabel,
                data: [],
                borderColor: rtColor,
                backgroundColor: rtColor,
                fill: false,
                spanGaps: false,
                yAxisID: src === 'temp' && rtIdx >= 1 ? 'y1' : 'y',
                order: 10  // render behind minute data
            };
            // Apply proper RT chart type styling
            _styleDatasetForType(ds, rtType);
            chart.data.datasets.push(ds);
        }

        // Remove extra realtime datasets (when switching away from 5m)
        while (chart.data.datasets.length > totalNeeded) {
            chart.data.datasets.pop();
        }
    }

    function _getRealtimeLabel(src, rtIdx) {
        const labels = {
            events:   ['RT Events', 'RT Muons'],
            sipm:     ['RT SiPM'],
            temp:     ['RT °C', 'RT hPa'],
            deadtime: ['RT Dead Time']
        };
        return (labels[src] && labels[src][rtIdx]) || 'RT Data';
    }

    function _getRealtimeColor(src, rtIdx) {
        const colors = {
            events:   [COLORS.rtEvents, COLORS.rtMuons],
            sipm:     [COLORS.rtSipm],
            temp:     [COLORS.rtTemp, COLORS.rtPressure],
            deadtime: [COLORS.rtDeadtime]
        };
        return (colors[src] && colors[src][rtIdx]) || 'rgba(128,128,128,0.3)';
    }

    /** Render 1m view: ONLY realtime/instantaneous data from detector */
    function _renderRealtimeOnly() {
        const rtRaw = DataManager.getRealtimeData();
        const now = Date.now();
        const minTime = now - 60_000;
        const maxTime = now;

        // Filter to last 60 seconds + buffer for edge continuity
        const bufferMs = PERF.CHART_EDGE_BUFFER_MS || 120_000;
        const filtered = rtRaw.filter(d => d.ts >= (minTime - bufferMs) && d.ts <= (maxTime + bufferMs));

        if (!filtered.length) {
            // Still update axes even with no data
            for (let slot = 0; slot < NUM_SLOTS; slot++) {
                if (!_charts[slot]) continue;
                _setChart(_charts[slot], _charts[slot].data.datasets.map(() => []), minTime, maxTime);
            }
            return;
        }

        const len = filtered.length;

        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            if (!_charts[slot]) continue;
            const src = _slotSource[slot];
            if (src === 'terminal') continue;

            // Strip any extra realtime-overlay datasets (1m only has base datasets)
            const minuteCount = _getMinuteDatasetCount(src);
            if (!minuteCount) continue;
            while (_charts[slot].data.datasets.length > minuteCount) {
                _charts[slot].data.datasets.pop();
            }

            const datasets = [];
            switch (src) {
                case 'events': {
                    // Aggregate events per second for meaningful Event Rate display
                    const evBuckets = _bucketEventsBySecond(filtered);
                    datasets.push(evBuckets.ev, evBuckets.mu);
                    break;
                }
                case 'sipm': {
                    const sa = new Array(len), sx = new Array(len), sn = new Array(len);
                    for (let i = 0; i < len; i++) {
                        const v = filtered[i].sipm || 0;
                        sa[i] = { x: filtered[i].ts, y: v };
                        sx[i] = { x: filtered[i].ts, y: v }; // in RT there's no min/max separation
                        sn[i] = { x: filtered[i].ts, y: v };
                    }
                    datasets.push(sa, sx, sn);
                    break;
                }
                case 'temp': {
                    const tp = new Array(len), pr = new Array(len);
                    for (let i = 0; i < len; i++) {
                        tp[i] = { x: filtered[i].ts, y: filtered[i].temp };
                        pr[i] = { x: filtered[i].ts, y: filtered[i].pressure != null ? filtered[i].pressure / 100 : null };
                    }
                    datasets.push(tp, pr);
                    break;
                }
                case 'deadtime': {
                    const dt = new Array(len);
                    for (let i = 0; i < len; i++) {
                        dt[i] = { x: filtered[i].ts, y: filtered[i].deadtime };
                    }
                    datasets.push(dt);
                    break;
                }
            }

            _setChart(_charts[slot], datasets, minTime, maxTime);
        }
    }

    function _setChart(chart, datasets, minTime, maxTime) {
        for (let i = 0; i < datasets.length; i++) {
            if (chart.data.datasets[i]) chart.data.datasets[i].data = datasets[i];
        }

        if (_isStackedMode && _stackedRealTimes.length > 0) {
            // STACKED: linear scale with real-time tick labels
            chart.options.scales.x.type = 'linear';
            chart.options.scales.x.min = minTime;
            chart.options.scales.x.max = maxTime;
            delete chart.options.scales.x.time;
            chart.options.scales.x.ticks.callback = function(value) {
                // value = index * 1000, convert back to index
                const idx = Math.round(value / 1000);
                if (idx >= 0 && idx < _stackedRealTimes.length) {
                    return new Date(_stackedRealTimes[idx]).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                }
                return '';
            };
        } else {
            // ACCURATE / normal: time scale
            chart.options.scales.x.type = 'time';
            if (!chart.options.scales.x.time) chart.options.scales.x.time = {};
            const rangeMin = (maxTime - minTime) / 60_000;
            let unit;
            if (rangeMin <= 5) unit = 'second'; else if (rangeMin <= 60) unit = 'minute'; else if (rangeMin <= 1440) unit = 'hour'; else unit = 'day';
            chart.options.scales.x.min = minTime;
            chart.options.scales.x.max = maxTime;
            chart.options.scales.x.time.unit = unit;
            chart.options.scales.x.time.displayFormats = { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm', day: 'MMM d' };
            delete chart.options.scales.x.ticks.callback;
        }

        // Bar chart offset: needed for bars to be visible on time axis
        const hasBar = chart.data.datasets.some(d => d.type === 'bar');
        if (chart.options.scales.x) {
            chart.options.scales.x.offset = hasBar;
        }

        chart.update('none');
    }

    /** Remove realtime overlay datasets when leaving 5m view */
    function _cleanupRealtimeOverlays() {
        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            const chart = _charts[slot];
            if (!chart) continue;
            const src = _slotSource[slot];
            const minuteCount = _getMinuteDatasetCount(src);
            if (!minuteCount) continue;
            while (chart.data.datasets.length > minuteCount) {
                chart.data.datasets.pop();
            }
        }
        _updateRtTypeButtons(false);
    }

    function _updateStats(data) {
        if (!data.length) return;
        const d = data[data.length - 1];
        const el = id => document.getElementById(id);
        el('statEventsMin').textContent  = d.ec ?? '--';
        el('statMuonsMin').textContent   = d.cc ?? '--';
        el('statSipmAvg').textContent    = d.sm != null ? `${d.sm.toFixed(1)} mV` : '-- mV';
        el('statTemp').textContent       = d.tp != null ? `${d.tp.toFixed(1)} °C` : '-- °C';
        el('statPressure').textContent   = d.pr != null ? `${(d.pr / 100).toFixed(1)} hPa` : '-- hPa';
        el('statLastUpdate').textContent = new Date(d.timestamp * 1000).toLocaleTimeString();
    }

    // ─── Time Axis Timer ────────────────────────────────────────────────
    function _startAxisTimer() {
        if (_axisTimerId) clearInterval(_axisTimerId);
        // Use faster interval for 1m/5m views to keep the sliding window current
        const interval = (_globalTimeRange === 1 || _globalTimeRange === 5) ? 2000 : PERF.TIME_AXIS_INTERVAL_MS;
        _axisTimerId = setInterval(() => {
            // Always update for realtime views; for other views only if in ACCURATE mode
            if (_globalTimeRange === 1 || _globalTimeRange === 5) {
                scheduleUpdate();
            } else if (!_isStackedMode && DataManager.getAllData().length > 0) {
                scheduleUpdate();
            }
        }, interval);
    }

    // ─── Chart Type Cycling (per slot) ──────────────────────────────────
    function cycleChartType(slot) {
        slot = parseInt(slot);
        if (isNaN(slot) || slot < 0 || slot >= NUM_SLOTS) return;
        if (_slotSource[slot] === 'terminal') return;

        const cur = _chartTypes[slot] || 'line';
        const next = CHART_TYPES[(CHART_TYPES.indexOf(cur) + 1) % CHART_TYPES.length];
        _chartTypes[slot] = next;
        localStorage.setItem(`munra_slot${slot}_chartType`, next);
        _applyChartType(slot, next);
        UIManager.showToast(`Chart: ${CHART_TYPE_LABELS[next] || next}`, 'success');
    }

    /** Cycle the realtime overlay chart type for a slot (5m view only) */
    function cycleRealtimeChartType(slot) {
        slot = parseInt(slot);
        if (isNaN(slot) || slot < 0 || slot >= NUM_SLOTS) return;
        if (_slotSource[slot] === 'terminal') return;

        const cur = _realtimeChartTypes[slot] || 'scatter';
        const next = CHART_TYPES[(CHART_TYPES.indexOf(cur) + 1) % CHART_TYPES.length];
        _realtimeChartTypes[slot] = next;
        localStorage.setItem(`munra_slot${slot}_rtChartType`, next);
        _applyRealtimeChartType(slot, next);
        UIManager.showToast(`RT: ${CHART_TYPE_LABELS[next] || next}`, 'success');
    }

    function _applyChartType(slot, type, silent = false) {
        const chart = _charts[slot];
        if (!chart) return;

        // Set type FIRST, then destroy and recreate.
        // _createChartForSlot reads _chartTypes[slot] to apply styling.
        _chartTypes[slot] = type;
        localStorage.setItem(`munra_slot${slot}_chartType`, type);
        _createChartForSlot(slot);  // Clean recreation — no recursion
        scheduleUpdate();           // Refill data on next frame
    }

    /** Apply chart type styling to realtime overlay datasets only */
    function _applyRealtimeChartType(slot, type) {
        const chart = _charts[slot];
        if (!chart) return;
        const minuteCount = _getMinuteDatasetCount(_slotSource[slot]);
        // Only apply to RT datasets (indices minuteCount..)
        chart.data.datasets.forEach((d, idx) => {
            if (idx < minuteCount) return;  // skip minute datasets
            _styleDatasetForType(d, type);
        });
        chart.update('none');
    }

    /** Style a single dataset object for a given chart type */
    function _styleDatasetForType(d, type) {
        d.type = type === 'bar' ? 'bar' : type === 'scatter' ? 'scatter' : 'line';
        // RESET ALL point properties explicitly to avoid stale values
        d.pointRadius = 0;
        d.pointStyle = false;
        d.pointHoverRadius = 0;
        d.pointHitRadius = 0;
        d.showLine = true;
        delete d.barThickness;

        // Read customization settings from saved preferences
        const dotSize = _getCustomization('dotSize', CHART_DEFAULTS.dotSize);
        const tension = _getCustomization('tension', CHART_DEFAULTS.tension);

        switch (type) {
            case 'scatter':
                d.pointRadius = dotSize; d.pointStyle = 'circle';
                d.pointHoverRadius = dotSize + 2; d.pointHitRadius = dotSize + 4;
                d.pointBackgroundColor = d.borderColor;
                d.pointBorderColor = d.borderColor;
                d.showLine = false; d.tension = 0; d.borderWidth = 1.5;
                break;
            case 'bar':
                d.tension = 0; d.borderWidth = 1;
                d.barThickness = 4;  // explicit pixel width for time-axis bars
                d.maxBarThickness = 40; d.minBarLength = 2;
                // Ensure visible bar fill
                if (d.borderColor) {
                    const c = d.borderColor;
                    if (c.startsWith('#')) {
                        const r = parseInt(c.slice(1,3), 16), g = parseInt(c.slice(3,5), 16), b = parseInt(c.slice(5,7), 16);
                        d.backgroundColor = `rgba(${r},${g},${b},0.7)`;
                    } else {
                        d.backgroundColor = c.replace(')', ',0.7)').replace('rgb', 'rgba');
                    }
                }
                break;
            case 'line-only':
                d.tension = 0; d.borderWidth = 2;
                break;
            case 'smooth':
                d.pointRadius = dotSize; d.pointStyle = 'circle';
                d.pointHoverRadius = dotSize + 2; d.pointHitRadius = dotSize + 4;
                d.pointBackgroundColor = d.borderColor;
                d.pointBorderColor = d.borderColor;
                d.tension = tension; d.borderWidth = 2;
                break;
            case 'smooth-no-dots':
                d.tension = tension; d.borderWidth = 2;
                break;
            default: // 'line' = Line + Dots
                d.pointRadius = dotSize; d.pointStyle = 'circle';
                d.pointHoverRadius = dotSize + 2; d.pointHitRadius = dotSize + 4;
                d.pointBackgroundColor = d.borderColor;
                d.pointBorderColor = d.borderColor;
                d.tension = 0; d.borderWidth = 1.5;
                break;
        }
    }

    /** Read a chart customization value from localStorage or use default */
    function _getCustomization(key, defaultVal) {
        const saved = localStorage.getItem(`munhub_chart_${key}`);
        return saved != null ? parseFloat(saved) : defaultVal;
    }

    /** Save a chart customization value */
    function setCustomization(key, value) {
        localStorage.setItem(`munhub_chart_${key}`, value);
        // Re-apply all chart types and redraw
        for (let s = 0; s < NUM_SLOTS; s++) {
            if (_slotSource[s] === 'terminal') continue;
            _createChartForSlot(s);
        }
        scheduleUpdate();
    }

    /** Get number of minute-average datasets for a given source */
    function _getMinuteDatasetCount(src) {
        switch (src) {
            case 'events':   return 2;
            case 'sipm':     return 3;
            case 'temp':     return 2;
            case 'deadtime': return 1;
            default:         return 0;
        }
    }

    /** Show or hide the "RT Type ▸" buttons depending on view mode */
    function _updateRtTypeButtons(show) {
        document.querySelectorAll('.chart-rt-type-btn').forEach(btn => {
            btn.style.display = show ? '' : 'none';
        });
    }

    // ─── Global Chart Type Cycling (all slots at once) ────────────────
    function cycleAllChartTypes() {
        // Use slot 0's current type as the reference, cycle to next
        const cur = _chartTypes[0] || 'line';
        const next = CHART_TYPES[(CHART_TYPES.indexOf(cur) + 1) % CHART_TYPES.length];
        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            if (_slotSource[slot] === 'terminal') continue;
            _chartTypes[slot] = next;
            localStorage.setItem(`munra_slot${slot}_chartType`, next);
            _applyChartType(slot, next, true);
        }
        // Update button label to show current type
        const btn = document.getElementById('globalTypeBtn');
        if (btn) btn.textContent = CHART_TYPE_LABELS[next] || next;
        UIManager.showToast(`All Charts: ${CHART_TYPE_LABELS[next] || next}`, 'success');
    }

    function cycleAllRealtimeChartTypes() {
        const cur = _realtimeChartTypes[0] || 'bar';
        const next = CHART_TYPES[(CHART_TYPES.indexOf(cur) + 1) % CHART_TYPES.length];
        for (let slot = 0; slot < NUM_SLOTS; slot++) {
            if (_slotSource[slot] === 'terminal') continue;
            _realtimeChartTypes[slot] = next;
            localStorage.setItem(`munra_slot${slot}_rtChartType`, next);
            _applyRealtimeChartType(slot, next);
        }
        // Update button label to show current RT type
        const btn = document.getElementById('globalRtTypeBtn');
        if (btn) btn.textContent = 'RT: ' + (CHART_TYPE_LABELS[next] || next);
        UIManager.showToast(`All RT: ${CHART_TYPE_LABELS[next] || next}`, 'success');
    }

    // ─── Per-Slot CSV Download ──────────────────────────────────────────
    function downloadChartData(slot) {
        slot = parseInt(slot);
        const chart = _charts[slot];
        if (!chart) return;
        const source = _slotSource[slot];

        let csv = 'Timestamp,DateTime';
        chart.data.datasets.forEach(d => { csv += ',' + (d.label || 'Value').replace(/,/g, ';'); });
        csv += '\n';

        const timestamps = new Set();
        chart.data.datasets.forEach(d => d.data.forEach(p => { if (p?.x) timestamps.add(p.x); }));
        const sorted = [...timestamps].sort((a, b) => a - b);

        sorted.forEach(ts => {
            csv += `${ts},${new Date(ts).toISOString()}`;
            chart.data.datasets.forEach(d => { const p = d.data.find(q => q?.x === ts); csv += ',' + (p ? p.y : ''); });
            csv += '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `munhub_${source}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        UIManager.showToast(`Downloaded ${source} data`, 'success');
    }

    // ─── Chart Info Popup ────────────────────────────────────────────
    function showChartInfo(slot) {
        slot = parseInt(slot);
        const panel = document.getElementById(`chartPanel${slot}`);
        if (!panel) return;
        // Remove existing popup
        const existing = panel.querySelector('.chart-info-popup');
        if (existing) { existing.remove(); return; }

        const src = _slotSource[slot];
        const info = typeof CHART_INFO !== 'undefined' ? CHART_INFO[src] : null;
        if (!info) return;

        const popup = document.createElement('div');
        popup.className = 'chart-info-popup';
        popup.innerHTML = `<button class="close-info">&times;</button><h4>${info.title}</h4><p>${info.desc}</p>`;
        popup.querySelector('.close-info').addEventListener('click', () => popup.remove());
        // Position relative to chart panel
        panel.style.position = 'relative';
        panel.appendChild(popup);
        // Auto-close after 8 seconds
        setTimeout(() => { if (popup.parentNode) popup.remove(); }, 8000);
    }

    // ─── Color Management ────────────────────────────────────────────
    /** Get current colors for all datasets in a slot */
    function getSlotColors(slot) {
        const chart = _charts[slot];
        if (!chart) return [];
        return chart.data.datasets.map(d => ({ label: d.label, color: d.borderColor }));
    }

    /** Set color for a specific dataset in a slot */
    function setDatasetColor(slot, dsIndex, color) {
        const chart = _charts[slot];
        if (!chart || !chart.data.datasets[dsIndex]) return;
        const d = chart.data.datasets[dsIndex];
        d.borderColor = color;
        d.pointBackgroundColor = color;
        d.pointBorderColor = color;
        // Update backgroundColor based on chart type
        const type = _chartTypes[slot] || 'line';
        if (type === 'bar') {
            const r = parseInt(color.slice(1,3), 16), g = parseInt(color.slice(3,5), 16), b = parseInt(color.slice(5,7), 16);
            d.backgroundColor = `rgba(${r},${g},${b},0.7)`;
        } else {
            const r = parseInt(color.slice(1,3), 16), g = parseInt(color.slice(3,5), 16), b = parseInt(color.slice(5,7), 16);
            d.backgroundColor = `rgba(${r},${g},${b},0.5)`;
        }
        // Save custom color
        localStorage.setItem(`munhub_color_${slot}_${dsIndex}`, color);
        chart.update('none');
    }

    /** Randomize all colors for a slot ensuring contrast */
    function randomizeSlotColors(slot) {
        const chart = _charts[slot];
        if (!chart) return;
        const colors = _generateDistinctColors(chart.data.datasets.length);
        chart.data.datasets.forEach((d, i) => setDatasetColor(slot, i, colors[i]));
    }

    /** Generate N visually distinct colors using golden angle hue spacing */
    function _generateDistinctColors(n) {
        const colors = [];
        const goldenAngle = 137.508;
        let hue = Math.random() * 360;
        for (let i = 0; i < n; i++) {
            hue = (hue + goldenAngle) % 360;
            const s = 65 + Math.random() * 20; // 65-85% saturation
            const l = 50 + Math.random() * 15; // 50-65% lightness
            colors.push(_hslToHex(hue, s, l));
        }
        return colors;
    }

    function _hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(c * 255).toString(16).padStart(2, '0'); };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    /** Get all dataset labels across all sources (for global color modal) */
    function getAllDatasetLabels() {
        const labels = [];
        for (let s = 0; s < NUM_SLOTS; s++) {
            if (!_charts[s]) continue;
            _charts[s].data.datasets.forEach((d, i) => {
                labels.push({ slot: s, index: i, label: d.label, color: d.borderColor });
            });
        }
        return labels;
    }

    /** Get current customization values */
    function getCustomizations() {
        return {
            dotSize: _getCustomization('dotSize', CHART_DEFAULTS.dotSize),
            barWidth: _getCustomization('barWidth', CHART_DEFAULTS.barWidth),
            tension: _getCustomization('tension', CHART_DEFAULTS.tension)
        };
    }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        init, scheduleUpdate, getTimeRange, setTimeRange, setCustomRange,
        isStacked, setStackedMode,
        setSlotSource, getTerminalSlot, appendTerminalLine,
        cycleChartType, cycleRealtimeChartType,
        cycleAllChartTypes, cycleAllRealtimeChartTypes,
        downloadChartData,
        showChartInfo,
        getSlotColors, setDatasetColor, randomizeSlotColors,
        getAllDatasetLabels, getCustomizations, setCustomization
    });
})();
