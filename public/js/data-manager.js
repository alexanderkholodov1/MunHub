/**
 * MunHub 5.0 — Data Manager
 * 
 * Owns ALL data state: sessions, realtime, processed arrays.
 * Handles Firebase subscriptions for the currently selected profile.
 * Provides the LTTB downsampling algorithm and a change-driven
 * notification so ChartManager only redraws when data actually changes.
 * 
 * v4.8 BANDWIDTH OPTIMIZATIONS:
 *   • Sessions: child_added/changed/removed instead of value listener
 *     (avoids re-downloading ALL sessions on every minute save)
 *   • Realtime: child_added instead of value listener
 *     (avoids re-downloading 500+ entries on every new event)
 *   • pushLocalRealtime: time-based cleanup (8 min) not count-based
 *   • cleanupAllRealtime removed — only current profile cleaned
 * 
 * Depends on: config.js, firebase-manager.js
 */

const DataManager = (() => {
    // ─── State ──────────────────────────────────────────────────────────
    let _currentProfile = '';
    let _sessionsData = {};
    let _allData = [];            // sorted minute-level points
    let _realtimeData = [];       // last N realtime entries
    let _latestData = null;
    let _hasRealtimeData = false; // true when profile has realtime entries

    // Firebase listener refs (so we can .off() cleanly)
    let _sessionRef = null;
    let _realtimeRef = null;
    let _latestRef = null;

    // Debounce rebuild (child_added fires many times on initial load)
    let _rebuildTimer = null;
    const _REBUILD_DEBOUNCE_MS = 150;

    // Change-notification callbacks
    /** @type {Function[]} */
    const _listeners = [];
    /** @type {Function[]} */
    const _realtimeListeners = [];

    // ─── Public Accessors ───────────────────────────────────────────────
    function getAllData()        { return _allData; }
    function getRealtimeData()   { return _realtimeData; }
    function getLatestData()     { return _latestData; }
    function getSessionsData()   { return _sessionsData; }
    function getCurrentProfile() { return _currentProfile; }
    function hasRealtimeData()   { return _hasRealtimeData; }

    /** Returns the timestamp (ms) of the most recent realtime entry, or 0 */
    function getLastRealtimeTimestamp() {
        if (!_realtimeData.length) return 0;
        return _realtimeData[_realtimeData.length - 1].ts;
    }

    /** Returns true if realtime data exists but is older than PERF.REALTIME_RETENTION_MS */
    function isRealtimeExpired() {
        if (!_hasRealtimeData) return false;
        const lastTs = getLastRealtimeTimestamp();
        if (!lastTs) return false;
        return (Date.now() - lastTs) > PERF.REALTIME_RETENTION_MS;
    }

    // ─── Listener Registration ──────────────────────────────────────────
    function onChange(fn) {
        if (typeof fn === 'function') _listeners.push(fn);
    }
    function onRealtimeChange(fn) {
        if (typeof fn === 'function') _realtimeListeners.push(fn);
    }

    function _notify() {
        for (const fn of _listeners) {
            try { fn(); } catch (e) { console.error('[DataManager] listener error:', e); }
        }
    }
    function _notifyRealtime() {
        for (const fn of _realtimeListeners) {
            try { fn(); } catch (e) { console.error('[DataManager] realtime listener error:', e); }
        }
    }

    // ─── Profile Subscription ───────────────────────────────────────────
    /**
     * Subscribe to a profile's data in Firebase.
     * Uses efficient listeners to minimize bandwidth:
     *   • latest: .on('value') — tiny payload, always needed
     *   • sessions: child_added/changed/removed — only new/changed data
     *   • realtime: child_added — only new entries, not full re-download
     */
    function subscribeToProfile(profileId) {
        const db = FirebaseManager.getDb();
        if (!db || !profileId) return;

        // Unsub previous
        _unsubscribe();
        _currentProfile = profileId;
        _sessionsData = {};
        _allData = [];

        const base = db.ref(`profiles/${profileId}`);

        // ── Latest value (for live stats) — tiny, always-on ──
        _latestRef = base.child('latest');
        _latestRef.on('value', snap => {
            _latestData = snap.val();
            if (_latestData) _updateLiveStatus(_latestData);
        });

        // ── Sessions (minute data) — incremental via child events ──
        // child_added fires once per existing session, then for new ones.
        // child_changed fires when minutes are added to a session.
        // This avoids re-downloading ALL sessions on every change.
        _sessionRef = base.child('sessions');

        _sessionRef.on('child_added', snap => {
            _sessionsData[snap.key] = snap.val();
            _scheduleRebuild();
        });

        _sessionRef.on('child_changed', snap => {
            _sessionsData[snap.key] = snap.val();
            _scheduleRebuild();
        });

        _sessionRef.on('child_removed', snap => {
            delete _sessionsData[snap.key];
            _scheduleRebuild();
        });

        // ── Realtime — incremental via child_added ──
        // OLD: .on('value') re-downloaded ALL 500 entries on every new event
        //      → at 11 events/sec that's ~550 entries * 50 bytes * 11/sec = 300KB/sec!
        // NEW: .on('child_added') only downloads each new entry once.
        _realtimeRef = base.child('realtime');
        _realtimeRef.orderByChild('ts').limitToLast(PERF.REALTIME_LIMIT)
            .on('child_added', snap => {
                const val = snap.val();
                if (val) {
                    _realtimeData.push(val);
                    _hasRealtimeData = true;
                    // Lightweight notify — debounced via chart throttle
                    _notifyRealtime();
                }
            });

        _realtimeRef.orderByChild('ts').limitToLast(PERF.REALTIME_LIMIT)
            .on('child_removed', snap => {
                const val = snap.val();
                if (val) {
                    const idx = _realtimeData.findIndex(d => d.ts === val.ts);
                    if (idx !== -1) _realtimeData.splice(idx, 1);
                    if (!_realtimeData.length) _hasRealtimeData = false;
                }
            });
    }

    /** Remove all Firebase listeners for the current profile. */
    function _unsubscribe() {
        if (_latestRef)   { _latestRef.off();   _latestRef = null; }
        if (_sessionRef)  { _sessionRef.off();  _sessionRef = null; }
        if (_realtimeRef) { _realtimeRef.off(); _realtimeRef = null; }
        if (_rebuildTimer) { clearTimeout(_rebuildTimer); _rebuildTimer = null; }
    }

    /** Schedule a debounced rebuild (child_added fires many times on initial load). */
    function _scheduleRebuild() {
        if (_rebuildTimer) clearTimeout(_rebuildTimer);
        _rebuildTimer = setTimeout(() => {
            _rebuildTimer = null;
            _rebuildAllData();
        }, _REBUILD_DEBOUNCE_MS);
    }

    /** Re-flatten session→minute data into _allData and notify listeners. */
    function _rebuildAllData() {
        const arr = [];
        for (const [sessionId, session] of Object.entries(_sessionsData)) {
            if (!session.minutes) continue;
            for (const [ts, data] of Object.entries(session.minutes)) {
                arr.push({ timestamp: parseInt(ts, 10), session: sessionId, ...data });
            }
        }
        arr.sort((a, b) => a.timestamp - b.timestamp);
        _allData = arr;
        _notify();
    }

    /** Update connection status indicator based on latest data age. */
    function _updateLiveStatus(latest) {
        const ageSec = Date.now() / 1000 - latest.ts;
        if (ageSec < 120) {
            UIManager.setConnectionStatus('connected', 'LIVE');
        } else if (ageSec < 3600) {
            UIManager.setConnectionStatus('connected', `${Math.floor(ageSec / 60)}m ago`);
        } else {
            UIManager.setConnectionStatus('error', `${Math.floor(ageSec / 3600)}h ago`);
        }
    }

    // ─── LTTB Downsampling ──────────────────────────────────────────────
    function downsample(data, targetPoints) {
        if (data.length <= targetPoints) return data;

        const result = [data[0]];
        const bucketSize = (data.length - 2) / (targetPoints - 2);
        let lastIdx = 0;

        for (let i = 0; i < targetPoints - 2; i++) {
            const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
            const rangeEnd   = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1);

            let avgX = 0, avgY = 0, avgN = 0;
            const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length);
            for (let j = rangeEnd; j < nextEnd; j++) {
                avgX += data[j].timestamp;
                avgY += (data[j].ec || 0);
                avgN++;
            }
            if (avgN) { avgX /= avgN; avgY /= avgN; }

            let maxArea = -1, bestIdx = rangeStart;
            const last = data[lastIdx];
            for (let j = rangeStart; j < rangeEnd; j++) {
                const area = Math.abs(
                    (last.timestamp - avgX) * ((data[j].ec || 0) - (last.ec || 0)) -
                    (last.timestamp - data[j].timestamp) * (avgY - (last.ec || 0))
                );
                if (area > maxArea) { maxArea = area; bestIdx = j; }
            }

            result.push(data[bestIdx]);
            lastIdx = bestIdx;
        }

        result.push(data[data.length - 1]);
        return result;
    }

    // ─── Storage Stats ──────────────────────────────────────────────────
    function getStorageStats() {
        let totalMinutes = 0;
        for (const session of Object.values(_sessionsData)) {
            if (session.minutes) totalMinutes += Object.keys(session.minutes).length;
        }
        return {
            minutes: totalMinutes,
            realtime: _realtimeData.length,
            connected: !!FirebaseManager.getDb()
        };
    }

    // ─── Disconnect ─────────────────────────────────────────────────────
    function disconnect() {
        _unsubscribe();
        _currentProfile = '';
        _sessionsData = {};
        _allData = [];
        _realtimeData = [];
        _latestData = null;
        _hasRealtimeData = false;
    }

    /**
     * Push a realtime data point directly to the in-memory buffer.
     * Uses TIME-BASED cleanup (8 min) instead of count-based.
     * This ensures 5m charts always have enough data regardless of event rate.
     */
    function pushLocalRealtime(point) {
        _realtimeData.push(point);
        // Time-based cleanup: remove entries older than 8 minutes
        const cutoff = Date.now() - PERF.REALTIME_RETENTION_MS;
        while (_realtimeData.length > 0 && _realtimeData[0].ts < cutoff) {
            _realtimeData.shift();
        }
        _hasRealtimeData = _realtimeData.length > 0;
        _notifyRealtime();
    }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        getAllData,
        getRealtimeData,
        getLatestData,
        getSessionsData,
        getCurrentProfile,
        getStorageStats,
        hasRealtimeData,
        getLastRealtimeTimestamp,
        isRealtimeExpired,
        onChange,
        onRealtimeChange,
        subscribeToProfile,
        disconnect,
        downsample,
        pushLocalRealtime
    });
})();
