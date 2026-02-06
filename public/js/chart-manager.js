/**
 * MuNRa 4.0 - Chart Manager
 * 
 * Owns Chart.js instances, handles ACCURATE vs STACKED modes,
 * throttled rendering, chart-type cycling, and per-chart data export.
 * 
 * KEY PERFORMANCE FIX: charts only redraw when DataManager notifies
 * of new data OR when the time-axis timer fires (at a sane interval).
 * No more 1-second full-rebuild loop.
 * 
 * Depends on: config.js, data-manager.js
 */

const ChartManager = (() => {
    // ─── State ──────────────────────────────────────────────────────────
    /** @type {{ events: Chart, sipm: Chart, temp: Chart, deadtime: Chart }} */
    const _charts = {};

    let _globalTimeRange = 15;          // minutes | 'all' | 'custom'
    let _customTimeStart = null;
    let _customTimeEnd = null;
    let _isStackedMode = false;
    let _chartTypes = { events: 'line', sipm: 'line', temp: 'line', deadtime: 'line' };

    // RAF throttle flag
    let _updateScheduled = false;
    let _lastUpdateTs = 0;

    // Time-axis timer id
    let _axisTimerId = null;

    // ─── Accessors / Mutators ───────────────────────────────────────────
    function getTimeRange()   { return _globalTimeRange; }
    function isStacked()      { return _isStackedMode; }

    function setTimeRange(range) {
        _globalTimeRange = range;
        localStorage.setItem('munra_range', range);
        scheduleUpdate();
    }

    function setCustomRange(start, end) {
        _customTimeStart = start;
        _customTimeEnd = end;
        _globalTimeRange = 'custom';
        localStorage.setItem('munra_range', 'custom');
        scheduleUpdate();
    }

    function setStackedMode(on) {
        _isStackedMode = on;
        localStorage.setItem('munra_stacked', on);
        scheduleUpdate();
    }

    // ─── Init Charts ────────────────────────────────────────────────────
    function init() {
        _loadPreferences();

        const tooltipCallbacks = {
            title(ctx) {
                if (ctx[0]?.raw?.realTime) {
                    return new Date(ctx[0].raw.realTime).toLocaleString();
                }
                return new Date(ctx[0].parsed.x).toLocaleString();
            }
        };

        const commonOpts = (yLabel = '') => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },   // instant — no wasteful tweens
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true, position: 'top',
                    labels: { boxWidth: 10, padding: 6, font: { size: 10 }, color: COLORS.tick }
                },
                tooltip: { callbacks: tooltipCallbacks }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'minute', displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm', day: 'MMM d' } },
                    ticks: { color: COLORS.tick, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    grid: { color: COLORS.grid }
                },
                y: {
                    ticks: { color: COLORS.tick, font: { size: 9 } },
                    grid: { color: COLORS.grid },
                    title: yLabel ? { display: true, text: yLabel, color: COLORS.tick, font: { size: 9 } } : {}
                }
            }
        });

        const ds = (label, color, extra = {}) => ({
            label, data: [], borderColor: color,
            backgroundColor: color.replace(')', ',0.1)').replace('rgb', 'rgba'),
            tension: 0, pointRadius: 2, borderWidth: 1.5, fill: false, spanGaps: false, ...extra
        });

        // Events
        _charts.events = new Chart(document.getElementById('chartEvents'), {
            type: 'line',
            data: { datasets: [ds('Events/min', COLORS.events), ds('Muons/min', COLORS.muons)] },
            options: commonOpts()
        });

        // SiPM
        _charts.sipm = new Chart(document.getElementById('chartSipm'), {
            type: 'line',
            data: {
                datasets: [
                    ds('Avg mV', COLORS.sipmAvg),
                    ds('Max mV', COLORS.sipmMax, { pointRadius: 1, borderWidth: 1, borderDash: [3, 2] }),
                    ds('Min mV', COLORS.sipmMin, { pointRadius: 1, borderWidth: 1, borderDash: [3, 2] })
                ]
            },
            options: commonOpts('mV')
        });

        // Temperature & Pressure (dual Y)
        _charts.temp = new Chart(document.getElementById('chartTemp'), {
            type: 'line',
            data: {
                datasets: [
                    ds('°C', COLORS.temp, { yAxisID: 'y' }),
                    ds('hPa', COLORS.pressure, { yAxisID: 'y1' })
                ]
            },
            options: {
                ...commonOpts(),
                scales: {
                    ...commonOpts().scales,
                    y:  { type: 'linear', position: 'left',  ticks: { color: COLORS.temp, font: { size: 9 } }, grid: { color: COLORS.grid }, title: { display: true, text: '°C', color: COLORS.temp, font: { size: 9 } } },
                    y1: { type: 'linear', position: 'right', ticks: { color: COLORS.pressure, font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'hPa', color: COLORS.pressure, font: { size: 9 } } }
                }
            }
        });

        // Deadtime
        _charts.deadtime = new Chart(document.getElementById('chartDeadtime'), {
            type: 'line',
            data: { datasets: [ds('Dead Time %', COLORS.deadtime)] },
            options: commonOpts('%')
        });

        // Apply saved chart-type preferences
        _applySavedChartTypes();

        // Start the time-axis ticker (moves "now" in ACCURATE mode)
        _startAxisTimer();
    }

    // ─── Preferences ────────────────────────────────────────────────────
    function _loadPreferences() {
        _isStackedMode = localStorage.getItem('munra_stacked') === 'true';
        const saved = localStorage.getItem('munra_range');
        _globalTimeRange = saved === 'all' || saved === 'custom' ? saved : (parseInt(saved) || 15);

        ['events', 'sipm', 'temp', 'deadtime'].forEach(name => {
            const t = localStorage.getItem(`munra_chartType_${name}`);
            if (t) _chartTypes[name] = t;
        });
    }

    function _applySavedChartTypes() {
        for (const [name, type] of Object.entries(_chartTypes)) {
            if (type !== 'line') _applyChartType(name, type, /* silent */ true);
        }
    }

    // ─── Throttled Update ───────────────────────────────────────────────
    /**
     * Schedule one chart redraw on the next animation frame,
     * but no more than once per PERF.CHART_THROTTLE_MS.
     */
    function scheduleUpdate() {
        if (_updateScheduled) return;
        const elapsed = performance.now() - _lastUpdateTs;
        if (elapsed < PERF.CHART_THROTTLE_MS) {
            _updateScheduled = true;
            setTimeout(() => {
                _updateScheduled = false;
                requestAnimationFrame(_updateCharts);
            }, PERF.CHART_THROTTLE_MS - elapsed);
        } else {
            _updateScheduled = true;
            requestAnimationFrame(() => {
                _updateScheduled = false;
                _updateCharts();
            });
        }
    }

    // ─── Core Render Logic ──────────────────────────────────────────────
    function _updateCharts() {
        _lastUpdateTs = performance.now();

        const allData = DataManager.getAllData();
        if (!allData.length && !_isStackedMode) {
            // Nothing to show — skip expensive Chart.js update calls
            return;
        }
        const now = Date.now();
        let minTime, maxTime, filtered;

        // ── Determine data window ──
        if (_globalTimeRange === 'all') {
            filtered = allData;
            if (filtered.length) {
                minTime = filtered[0].timestamp * 1000;
                maxTime = filtered[filtered.length - 1].timestamp * 1000;
            } else {
                minTime = now - 15 * 60_000;
                maxTime = now;
            }
        } else if (_globalTimeRange === 'custom' && _customTimeStart && _customTimeEnd) {
            minTime = _customTimeStart;
            maxTime = _customTimeEnd;
            filtered = allData.filter(d => {
                const ts = d.timestamp * 1000;
                return ts >= minTime && ts <= maxTime;
            });
        } else {
            const rangeMs = (typeof _globalTimeRange === 'number' ? _globalTimeRange : 15) * 60_000;
            if (_isStackedMode) {
                const wanted = typeof _globalTimeRange === 'number' ? _globalTimeRange : 15;
                filtered = allData.slice(-wanted);
                if (filtered.length) {
                    minTime = filtered[0].timestamp * 1000;
                    maxTime = filtered[filtered.length - 1].timestamp * 1000;
                } else {
                    minTime = now - rangeMs;
                    maxTime = now;
                }
            } else {
                minTime = now - rangeMs;
                maxTime = now;
                filtered = allData.filter(d => {
                    const ts = d.timestamp * 1000;
                    return ts >= minTime && ts <= maxTime;
                });
            }
        }

        // ── STACKED: create virtual consecutive timestamps ──
        let chartData = filtered;
        let cMin = minTime, cMax = maxTime;

        if (_isStackedMode && filtered.length) {
            const base = filtered[0].timestamp * 1000;
            chartData = new Array(filtered.length);
            for (let i = 0; i < filtered.length; i++) {
                const d = filtered[i];
                chartData[i] = {
                    timestamp: d.timestamp, ec: d.ec, cc: d.cc,
                    sm: d.sm, sn: d.sn, sx: d.sx,
                    tp: d.tp, pr: d.pr, dt: d.dt,
                    virtualTs: base + i * 60_000,
                    realTime: d.timestamp * 1000
                };
            }
            cMin = base;
            cMax = base + (filtered.length - 1) * 60_000;
        }

        // ── ACCURATE: insert nulls at gaps > 2 min ──
        if (!_isStackedMode && chartData.length > 1) {
            const withGaps = [];
            for (let i = 0; i < chartData.length; i++) {
                withGaps.push(chartData[i]);
                if (i < chartData.length - 1) {
                    const gap = (chartData[i + 1].timestamp - chartData[i].timestamp) * 1000;
                    if (gap > GAP_THRESHOLD_MS) {
                        withGaps.push({ timestamp: chartData[i].timestamp + 1, isGap: true });
                    }
                }
            }
            chartData = withGaps;
        }

        // ── Downsample for performance ──
        if (chartData.length > PERF.MAX_CHART_POINTS) {
            chartData = DataManager.downsample(chartData, PERF.MAX_CHART_POINTS);
        }

        // ── Build typed arrays for each dataset ──
        const getX = d => _isStackedMode ? d.virtualTs : d.timestamp * 1000;
        const pt  = (d, field) => ({ x: getX(d), y: d.isGap ? null : (d[field] || 0),    realTime: d.timestamp * 1000 });
        const ptN = (d, field) => ({ x: getX(d), y: d.isGap ? null : (d[field] || null),  realTime: d.timestamp * 1000 });
        const ptP = d          => ({ x: getX(d), y: d.isGap ? null : (d.pr ? d.pr / 100 : null), realTime: d.timestamp * 1000 });

        const len = chartData.length;
        const evArr = new Array(len), muArr = new Array(len);
        const saArr = new Array(len), sxArr = new Array(len), snArr = new Array(len);
        const tpArr = new Array(len), prArr = new Array(len);
        const dtArr = new Array(len);

        for (let i = 0; i < len; i++) {
            const d = chartData[i];
            evArr[i] = pt(d, 'ec');
            muArr[i] = pt(d, 'cc');
            saArr[i] = pt(d, 'sm');
            sxArr[i] = pt(d, 'sx');
            snArr[i] = pt(d, 'sn');
            tpArr[i] = ptN(d, 'tp');
            prArr[i] = ptP(d);
            dtArr[i] = ptN(d, 'dt');
        }

        // ── Push to charts ──
        _setChart(_charts.events,   [evArr, muArr],          cMin, cMax);
        _setChart(_charts.sipm,     [saArr, sxArr, snArr],   cMin, cMax);
        _setChart(_charts.temp,     [tpArr, prArr],          cMin, cMax);
        _setChart(_charts.deadtime, [dtArr],                 cMin, cMax);

        // ── Stats bar ──
        _updateStats(filtered);
    }

    function _setChart(chart, datasets, minTime, maxTime) {
        for (let i = 0; i < datasets.length; i++) {
            if (chart.data.datasets[i]) chart.data.datasets[i].data = datasets[i];
        }

        const rangeMin = (maxTime - minTime) / 60_000;
        let unit;
        if (rangeMin <= 5)        unit = 'second';
        else if (rangeMin <= 60)  unit = 'minute';
        else if (rangeMin <= 1440) unit = 'hour';
        else                       unit = 'day';

        chart.options.scales.x.min = minTime;
        chart.options.scales.x.max = maxTime;
        chart.options.scales.x.time.unit = unit;
        chart.update('none');
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
        _axisTimerId = setInterval(() => {
            // Only update axis if in ACCURATE mode AND data is loaded
            if (!_isStackedMode && DataManager.getAllData().length > 0) {
                scheduleUpdate();
            }
        }, PERF.TIME_AXIS_INTERVAL_MS);
    }

    // ─── Chart Type Cycling ─────────────────────────────────────────────
    function cycleChartType(name) {
        const cur = _chartTypes[name] || 'line';
        const next = CHART_TYPES[(CHART_TYPES.indexOf(cur) + 1) % CHART_TYPES.length];
        _chartTypes[name] = next;
        localStorage.setItem(`munra_chartType_${name}`, next);
        _applyChartType(name, next);
        UIManager.showToast(`Chart: ${CHART_TYPE_LABELS[next] || next}`, 'success');
    }

    function _applyChartType(name, type, silent = false) {
        const chart = _charts[name];
        if (!chart) return;
        chart.data.datasets.forEach(ds => {
            ds.type = type === 'bar' ? 'bar' : type === 'scatter' ? 'scatter' : 'line';
            switch (type) {
                case 'scatter':
                    ds.pointRadius = 4; ds.showLine = false; ds.tension = 0; break;
                case 'bar':
                    ds.pointRadius = 0; ds.showLine = true; ds.tension = 0; break;
                case 'line-only':
                    ds.pointRadius = 0; ds.showLine = true; ds.tension = 0; ds.borderWidth = 2; break;
                case 'smooth':
                    ds.pointRadius = 0; ds.showLine = true; ds.tension = 0.4; ds.borderWidth = 2; break;
                default: // 'line'
                    ds.pointRadius = 2; ds.showLine = true; ds.tension = 0; ds.borderWidth = 1.5; break;
            }
        });
        chart.update('none');
    }

    // ─── Per-Chart CSV Download ─────────────────────────────────────────
    function downloadChartData(name) {
        const chart = _charts[name];
        if (!chart) return;

        let csv = 'Timestamp,DateTime';
        chart.data.datasets.forEach(ds => {
            csv += ',' + (ds.label || 'Value').replace(/,/g, ';');
        });
        csv += '\n';

        const timestamps = new Set();
        chart.data.datasets.forEach(ds => ds.data.forEach(p => { if (p?.x) timestamps.add(p.x); }));
        const sorted = [...timestamps].sort((a, b) => a - b);

        sorted.forEach(ts => {
            csv += `${ts},${new Date(ts).toISOString()}`;
            chart.data.datasets.forEach(ds => {
                const p = ds.data.find(q => q?.x === ts);
                csv += ',' + (p ? p.y : '');
            });
            csv += '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `munra_${name}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        UIManager.showToast(`Downloaded ${name} data`, 'success');
    }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        init,
        scheduleUpdate,
        getTimeRange,
        setTimeRange,
        setCustomRange,
        isStacked,
        setStackedMode,
        cycleChartType,
        downloadChartData
    });
})();
