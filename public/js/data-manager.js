/**
 * MuNRa 4.0 - Data Manager
 * 
 * Owns ALL data state: sessions, realtime, processed arrays.
 * Handles Firebase subscriptions for the currently selected profile.
 * Provides the LTTB downsampling algorithm and a change-driven
 * notification so ChartManager only redraws when data actually changes.
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

    /** Returns true if realtime data exists but is older than PERF.REALTIME_RETENTION_MS (5 min) */
    function isRealtimeExpired() {
        if (!_hasRealtimeData) return false;
        const lastTs = getLastRealtimeTimestamp();
        if (!lastTs) return false;
        return (Date.now() - lastTs) > PERF.REALTIME_RETENTION_MS;
    }

    // ─── Listener Registration ──────────────────────────────────────────
    /** Register a callback that fires whenever allData changes. */
    function onChange(fn) {
        if (typeof fn === 'function') _listeners.push(fn);
    }

    /** Register a callback that fires whenever realtimeData changes. */
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
     * Unsubscribes from the previous profile first.
     *
     * @param {string} profileId
     */
    function subscribeToProfile(profileId) {
        const db = FirebaseManager.getDb();
        if (!db || !profileId) return;

        // Unsub previous
        _unsubscribe();
        _currentProfile = profileId;

        const base = db.ref(`profiles/${profileId}`);

        // Latest value (for live stats)
        _latestRef = base.child('latest');
        _latestRef.on('value', snap => {
            _latestData = snap.val();
            if (_latestData) _updateLiveStatus(_latestData);
        });

        // Sessions (minute data)
        _sessionRef = base.child('sessions');
        _sessionRef.on('value', snap => {
            _sessionsData = snap.val() || {};
            _rebuildAllData();
        });

        // Realtime (last 500)
        _realtimeRef = base.child('realtime');
        _realtimeRef.orderByChild('ts').limitToLast(PERF.REALTIME_LIMIT).on('value', snap => {
            const raw = snap.val();
            _realtimeData = raw
                ? Object.values(raw).sort((a, b) => a.ts - b.ts)
                : [];
            const hadData = _hasRealtimeData;
            _hasRealtimeData = _realtimeData.length > 0;
            _notifyRealtime();
            // Also notify minute listeners if realtime availability changed
            if (hadData !== _hasRealtimeData) _notify();
        });
    }

    /** Remove all Firebase listeners for the current profile. */
    function _unsubscribe() {
        if (_latestRef)  { _latestRef.off();  _latestRef = null; }
        if (_sessionRef) { _sessionRef.off(); _sessionRef = null; }
        if (_realtimeRef){ _realtimeRef.off(); _realtimeRef = null; }
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
    /**
     * Largest-Triangle-Three-Buckets algorithm.
     * Returns a visually representative subset of `data`.
     *
     * @param {Array} data         - Sorted array of objects with `timestamp` and `ec`.
     * @param {number} targetPoints - Desired output size.
     * @returns {Array}
     */
    function downsample(data, targetPoints) {
        if (data.length <= targetPoints) return data;

        const result = [data[0]];
        const bucketSize = (data.length - 2) / (targetPoints - 2);
        let lastIdx = 0;

        for (let i = 0; i < targetPoints - 2; i++) {
            const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
            const rangeEnd   = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1);

            // Average point in next bucket
            let avgX = 0, avgY = 0, avgN = 0;
            const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length);
            for (let j = rangeEnd; j < nextEnd; j++) {
                avgX += data[j].timestamp;
                avgY += (data[j].ec || 0);
                avgN++;
            }
            if (avgN) { avgX /= avgN; avgY /= avgN; }

            // Largest triangle
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

    // ─── Realtime Cleanup ───────────────────────────────────────────────
    /** Delete realtime entries older than PERF.REALTIME_RETENTION_MS for ALL profiles. */
    async function cleanupAllRealtime() {
        const db = FirebaseManager.getDb();
        if (!db) return;

        try {
            const snap = await db.ref('profiles').once('value');
            const profiles = snap.val();
            if (!profiles) return;

            const cutoff = Date.now() - PERF.REALTIME_RETENTION_MS;
            let total = 0;

            for (const pid of Object.keys(profiles)) {
                total += await _cleanupProfileRealtime(pid, cutoff);
            }
            if (total > 0) console.log(`[Cleanup] Removed ${total} old realtime records`);
        } catch (err) {
            console.error('[Cleanup] Error:', err);
        }
    }

    async function _cleanupProfileRealtime(profileId, cutoff) {
        const db = FirebaseManager.getDb();
        try {
            const snap = await db.ref(`profiles/${profileId}/realtime`)
                .orderByChild('ts').endAt(cutoff).once('value');
            if (!snap.exists()) return 0;

            const updates = {};
            snap.forEach(child => { updates[child.key] = null; });
            const count = Object.keys(updates).length;
            if (count) await db.ref(`profiles/${profileId}/realtime`).update(updates);
            return count;
        } catch (err) {
            if (!err.message.includes('permission_denied')) {
                console.error(`[Cleanup] ${profileId}:`, err);
            }
            return 0;
        }
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
     * Used by serial-reader.js to provide immediate chart data
     * WITHOUT writing to Firebase (which requires enableRealtime).
     * This makes 1m/5m views work instantly regardless of the enableRealtime setting.
     */
    function pushLocalRealtime(point) {
        _realtimeData.push(point);
        // Keep within limit
        while (_realtimeData.length > PERF.REALTIME_LIMIT) _realtimeData.shift();
        _hasRealtimeData = true;
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
        cleanupAllRealtime,
        pushLocalRealtime
    });
})();
