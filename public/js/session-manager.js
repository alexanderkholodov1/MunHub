/**
 * MuNRa 4.8.1 — Session Manager
 *
 * Manages session lifecycle for detector profiles:
 *   • List sessions with full metadata (name, start/end, minute count)
 *   • Download individual sessions as CSV
 *   • Delete sessions (with confirmation)
 *   • Upload raw serial log files — CHUNKED & SEQUENTIAL processing
 *   • Duplicate minute detection with user-chosen resolution
 *
 * Files can be tens/hundreds of MB.  The pipeline never loads the full
 * text at once — it streams through a ReadableStream, aggregates by
 * minute in O(1) memory, and uploads to Firebase in small batches.
 *
 * Depends on: config.js, firebase-manager.js, data-manager.js,
 *             ui-manager.js, profile-manager.js
 */

const SessionManager = (() => {
    // ─── Constants ──────────────────────────────────────────────────────
    const UPLOAD_BATCH_SIZE = 200;        // minutes per Firebase write
    const LINES_PER_YIELD   = 5000;       // lines before setTimeout(0) yield

    // ─── Private state ──────────────────────────────────────────────────
    let _progressEl = null;
    let _aborted    = false;

    /* ═══════════════════════════════════════════════════════════════════
       SESSION LIST MODAL
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Show a modal listing all sessions for `profileId`.
     * Each session row has: name, start/end, minute count, download, delete.
     * Also provides an "Upload Session" button.
     */
    async function showSessionsModal(profileId) {
        const db = FirebaseManager.getDb();
        if (!db) { UIManager.showToast('Not connected to database', 'error'); return; }

        const profileName = _profileName(profileId);

        // Fetch sessions
        let sessions = {};
        try {
            const snap = await db.ref(`profiles/${profileId}/sessions`).once('value');
            sessions = snap.val() || {};
        } catch (e) {
            UIManager.showToast('Could not load sessions: ' + e.message, 'error');
            return;
        }

        const ids = Object.keys(sessions).sort((a, b) => {
            const ta = sessions[a].startTime || 0;
            const tb = sessions[b].startTime || 0;
            return tb - ta;   // newest first
        });

        // Build HTML
        let rows = '';
        if (!ids.length) {
            rows = '<p style="text-align:center;color:var(--text-secondary);padding:30px 0">No sessions recorded yet.</p>';
        } else {
            for (const sid of ids) {
                const s = sessions[sid];
                rows += _sessionRow(profileId, sid, s);
            }
        }

        const modal = _overlay('sessionsModal', `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <h2 style="color:var(--text-primary);margin:0">Sessions — ${_esc(profileName)}</h2>
                <button onclick="SessionManager.closeModal('sessionsModal')"
                    style="background:none;border:none;color:var(--text-secondary);font-size:1.4rem;cursor:pointer;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:5px">&times;</button>
            </div>
            <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
                <button id="sessUploadBtn" onclick="SessionManager.triggerUpload('${profileId}')"
                    style="padding:8px 18px;border:none;border-radius:6px;background:linear-gradient(135deg,#00d4ff,#7b2cbf);color:#fff;cursor:pointer;font-weight:600;font-size:13px">⬆ Upload Session File</button>
                <input type="file" id="sessFileInput" accept=".txt,.log,.csv,.json,.jsonl" style="display:none">
                <span style="font-size:12px;color:var(--text-secondary);align-self:center">${ids.length} session${ids.length !== 1 ? 's' : ''}</span>
            </div>
            <div id="sessionsList" style="max-height:55vh;overflow-y:auto">${rows}</div>
        `);
        document.body.appendChild(modal);

        // Wire file input
        const inp = document.getElementById('sessFileInput');
        if (inp) inp.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) _startUpload(profileId, file);
            inp.value = '';
        });
    }

    /** Build one session row. */
    function _sessionRow(profileId, sid, s) {
        const minCount = s.minutes ? Object.keys(s.minutes).length : 0;
        const name     = s.name || sid;
        const start    = s.startTime ? _fmtDate(s.startTime) : (s.meta?.uploaded_at ? s.meta.uploaded_at.replace('T', ' ').substring(0, 19) : '—');
        const end      = s.endTime   ? _fmtDate(s.endTime) : '—';
        const status   = s.status || 'completed';
        const statusColor = status === 'recording' ? '#e5a00d' : '#2ea043';
        const events   = s.meta?.total_events ? `${Number(s.meta.total_events).toLocaleString()} events` : '';
        const source   = s.meta?.source_file  ? `File: ${s.meta.source_file}` : '';

        return `
        <div style="background:var(--bg-tertiary);border-radius:8px;border:1px solid var(--border-color);margin-bottom:10px;overflow:hidden">
            <div style="padding:12px;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:flex-start">
                <div style="min-width:200px;flex:1">
                    <div style="font-weight:600;color:var(--text-primary);font-size:13px;margin-bottom:2px">${_esc(name)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);line-height:1.6">
                        <span style="color:${statusColor};font-weight:600;text-transform:uppercase">${status}</span><br>
                        Start: ${start}<br>
                        End: ${end}<br>
                        ${minCount} minute${minCount !== 1 ? 's' : ''}${events ? ' · ' + events : ''}
                        ${source ? '<br>' + source : ''}
                    </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-self:center">
                    <button onclick="SessionManager.downloadSession('${profileId}','${sid}')"
                        style="padding:5px 12px;border:none;border-radius:5px;background:#0d6efd;color:#fff;cursor:pointer;font-size:11px" title="Download CSV">⬇ CSV</button>
                    <button onclick="SessionManager.deleteSession('${profileId}','${sid}','${_esc(name)}')"
                        style="padding:5px 12px;border:none;border-radius:5px;background:#f85149;color:#fff;cursor:pointer;font-size:11px">Delete</button>
                </div>
            </div>
        </div>`;
    }

    /* ═══════════════════════════════════════════════════════════════════
       DOWNLOAD SESSION
       ═══════════════════════════════════════════════════════════════════ */

    async function downloadSession(profileId, sessionId) {
        const db = FirebaseManager.getDb();
        if (!db) return;

        UIManager.showToast('Preparing download…', 'info');

        try {
            const snap = await db.ref(`profiles/${profileId}/sessions/${sessionId}`).once('value');
            const session = snap.val();
            if (!session?.minutes) { UIManager.showToast('Session has no data', 'error'); return; }

            const sorted = Object.entries(session.minutes)
                .map(([ts, d]) => ({ ts: parseInt(ts, 10), ...d }))
                .sort((a, b) => a.ts - b.ts);

            let csv = 'Timestamp,DateTime,Events,Muons,SiPM_Avg,SiPM_Min,SiPM_Max,Temperature,Pressure,DeadTime\n';
            for (const d of sorted) {
                csv += `${d.ts},${new Date(d.ts * 1000).toISOString()},`;
                csv += `${d.ec ?? ''},${d.cc ?? ''},${d.sm ?? ''},${d.sn ?? ''},${d.sx ?? ''},`;
                csv += `${d.tp ?? ''},${d.pr ?? ''},${d.dt ?? ''}\n`;
            }

            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `munra_${profileId}_${sessionId}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);

            UIManager.showToast(`Downloaded ${sorted.length} minutes`, 'success');
        } catch (e) {
            UIManager.showToast('Download error: ' + e.message, 'error');
        }
    }

    /* ═══════════════════════════════════════════════════════════════════
       DELETE SESSION
       ═══════════════════════════════════════════════════════════════════ */

    async function deleteSession(profileId, sessionId, name) {
        if (!confirm(`Delete session "${name || sessionId}"?\nAll minute data in this session will be permanently deleted.`)) return;

        const db = FirebaseManager.getDb();
        if (!db) return;

        try {
            await db.ref(`profiles/${profileId}/sessions/${sessionId}`).remove();
            UIManager.showToast('Session deleted', 'success');
            // Refresh the modal
            closeModal('sessionsModal');
            showSessionsModal(profileId);
        } catch (e) {
            UIManager.showToast('Delete error: ' + e.message, 'error');
        }
    }

    /* ═══════════════════════════════════════════════════════════════════
       UPLOAD — ENTRY POINT
       ═══════════════════════════════════════════════════════════════════ */

    function triggerUpload(profileId) {
        const inp = document.getElementById('sessFileInput');
        if (inp) {
            inp.dataset.profile = profileId;
            inp.click();
        }
    }

    /**
     * Full upload pipeline:
     *   1. Stream-parse the file (chunked, yields to UI)
     *   2. Detect duplicates against existing profile data
     *   3. Let user resolve duplicates
     *   4. Upload in batches to Firebase
     */
    async function _startUpload(profileId, file) {
        _aborted = false;
        const sizeMB = (file.size / 1048576).toFixed(1);
        _showProgress(`Uploading: ${file.name} (${sizeMB} MB)`);

        // ── Phase 1: Parse ──────────────────────────────────────────────
        _step('🔍', `File: ${file.name} — ${sizeMB} MB`);
        _step('⏳', 'Reading and parsing…');
        _bar(0);

        let result;
        try {
            result = await _parseFile(file);
        } catch (e) {
            _step('❌', e.message, 'error');
            _result(false, 'Parsing failed', e.message);
            return;
        }
        if (_aborted) { _step('⚠️', 'Aborted by user'); _showCloseBtn(); return; }

        const { minutes, totalEvents, totalLines, startDateISO, endDateISO } = result;
        const minuteCount = Object.keys(minutes).length;

        _bar(50);
        _step('✅', `Parsed ${totalLines.toLocaleString()} lines → ${totalEvents.toLocaleString()} events`, 'success');
        _step('✅', `Aggregated into ${minuteCount.toLocaleString()} minutes`, 'success');
        if (startDateISO) _step('📅', `Period: ${startDateISO} → ${endDateISO}`);

        if (!minuteCount) { _result(false, 'No valid minute data found'); return; }

        // ── Phase 2: Duplicate check ────────────────────────────────────
        _step('🔍', 'Checking for duplicate minutes…');

        let dupeCount = 0;
        let existingTs;
        try {
            existingTs = await _getExistingTimestamps(profileId);
            for (const ts of Object.keys(minutes)) {
                if (existingTs.has(ts)) dupeCount++;
            }
        } catch (e) {
            _step('⚠️', 'Could not check duplicates: ' + e.message);
            existingTs = new Set();
        }

        let keepUploaded = true;   // default: overwrite with uploaded data

        if (dupeCount > 0) {
            _step('⚠️', `Found ${dupeCount} overlapping minute${dupeCount > 1 ? 's' : ''} with existing data`);

            // Ask user
            const choice = await _askDuplicateResolution(dupeCount, minuteCount);
            if (choice === 'cancel') { _step('⚠️', 'Upload cancelled by user'); _showCloseBtn(); return; }
            keepUploaded = (choice === 'upload');
            _step('✅', keepUploaded
                ? 'User chose: keep UPLOADED data (overwrite existing)'
                : 'User chose: keep EXISTING data (skip duplicates)', 'success');
        } else {
            _step('✅', 'No duplicates found', 'success');
        }

        // ── Phase 3: Filter duplicates if keeping existing ──────────────
        let finalMinutes = minutes;
        if (!keepUploaded && dupeCount > 0) {
            finalMinutes = {};
            for (const [ts, data] of Object.entries(minutes)) {
                if (!existingTs.has(ts)) finalMinutes[ts] = data;
            }
            const skipped = minuteCount - Object.keys(finalMinutes).length;
            _step('📋', `Skipping ${skipped} duplicate minutes, uploading ${Object.keys(finalMinutes).length} new minutes`);
        }

        const finalCount = Object.keys(finalMinutes).length;
        if (!finalCount) { _result(true, 'Nothing to upload — all minutes already exist'); return; }

        // ── Phase 4: Upload to Firebase in batches ──────────────────────
        const sessionId = _generateSessionId(finalMinutes);
        _step('☁️', `Uploading session ${sessionId}…`);

        try {
            await _uploadToFirebase(profileId, sessionId, finalMinutes, file.name, totalEvents, (pct) => {
                _bar(50 + Math.floor(pct * 45));
            });
        } catch (e) {
            _step('❌', 'Upload failed: ' + e.message, 'error');
            _result(false, 'Upload failed', e.message);
            return;
        }

        // ── Phase 5: Verify ─────────────────────────────────────────────
        _step('🔍', 'Verifying…');
        _bar(97);
        try {
            const snap = await FirebaseManager.getDb()
                .ref(`profiles/${profileId}/sessions/${sessionId}/minutes`)
                .once('value');
            const uploaded = snap.val();
            const uploadedCount = uploaded ? Object.keys(uploaded).length : 0;
            _bar(100);
            if (uploadedCount === finalCount) {
                _step('✅', `Verified: ${uploadedCount} minutes in Firebase`, 'success');
            } else {
                _step('⚠️', `Verification: expected ${finalCount}, got ${uploadedCount}`);
            }
        } catch (e) {
            _step('⚠️', 'Could not verify: ' + e.message);
            _bar(100);
        }

        _result(true, 'Upload completed!',
            `File: ${file.name}<br>` +
            `Events: ${totalEvents.toLocaleString()}<br>` +
            `Minutes: ${finalCount.toLocaleString()}<br>` +
            `Session: ${sessionId}` +
            (dupeCount ? `<br>Duplicates ${keepUploaded ? 'overwritten' : 'skipped'}: ${dupeCount}` : ''));

        // Refresh session list if open
        closeModal('sessionsModal');
        showSessionsModal(profileId);
    }

    /* ═══════════════════════════════════════════════════════════════════
       FILE PARSING — CHUNKED & STREAMING
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Parse a serial log file using ReadableStream for memory efficiency.
     * Yields to the UI thread every LINES_PER_YIELD lines.
     *
     * Supports two header formats:
     *   1. "--- Log started by ... at ISO_DATE ---"  → anchor absolute time
     *   2. No header → infer date from filename or use today
     *
     * Returns: { minutes, totalEvents, totalLines, startDateISO, endDateISO }
     */
    async function _parseFile(file) {
        // Accumulators
        const minutes    = {};             // key = unix seconds, value = aggregator
        let totalEvents  = 0;
        let totalLines   = 0;
        let startDateMs  = null;           // wall-clock ms of first event
        let endDateMs    = null;           // wall-clock ms of last event
        let firstDetTs   = null;           // first detector timestamp (ms)
        let logStartDate = null;           // from header "--- Log started ... at ISO ---"
        let logEndDate   = null;
        let filenameDate = _dateFromFilename(file.name);

        // ── Stream the file ─────────────────────────────────────────────
        const decoder = new TextDecoder();
        let readable;

        // Use ReadableStream if available (modern browsers), else fallback
        if (typeof file.stream === 'function') {
            readable = file.stream().getReader();
        } else {
            // Fallback: read entire file (for old browsers)
            const text = await _readFileAsText(file);
            const lines = text.split('\n');
            // Simulate a reader
            readable = {
                _lines: lines, _i: 0,
                async read() {
                    if (this._i >= this._lines.length) return { done: true };
                    const chunk = this._lines.slice(this._i, this._i + 5000).join('\n') + '\n';
                    this._i += 5000;
                    return { done: false, value: chunk };
                }
            };
        }

        let buffer = '';
        let linesSinceYield = 0;

        while (true) {
            if (_aborted) break;

            const { done, value } = await readable.read();
            if (done) break;

            // Decode Uint8Array or use string directly
            buffer += (typeof value === 'string') ? value : decoder.decode(value, { stream: true });

            // Split into complete lines
            const parts = buffer.split('\n');
            buffer = parts.pop();   // stash the incomplete tail

            for (const raw of parts) {
                const line = raw.trim();
                totalLines++;
                linesSinceYield++;

                if (!line) continue;

                // ─ Header detection ─────────────────────────────────────
                const headerMatch = line.match(/^---\s*Log\s+started.*at\s+(\S+)\s*---$/i);
                if (headerMatch) {
                    logStartDate = new Date(headerMatch[1]);
                    if (isNaN(logStartDate.getTime())) logStartDate = null;
                    continue;
                }
                const endMatch = line.match(/^---\s*Log\s+stopped.*at\s+(\S+)\s*---$/i);
                if (endMatch) {
                    logEndDate = new Date(endMatch[1]);
                    if (isNaN(logEndDate.getTime())) logEndDate = null;
                    continue;
                }

                // ─ Skip non-data lines ──────────────────────────────────
                if (/^[A-Za-z]/.test(line) || line.includes('[') || line.includes('Event') || line.includes('TimeStamp')) continue;
                if (line.length < 5 || !/\d/.test(line)) continue;

                // ─ Parse data line ──────────────────────────────────────
                const cols = line.split(/[\t ]+/);
                if (cols.length < 7) continue;

                const detTs     = parseFloat(cols[1]);  // detector internal ms
                const sipmMv    = parseFloat(cols[4]);   // SiPM mV
                const pressureP = parseFloat(cols[5]);   // Pressure Pa
                const tempC     = parseFloat(cols[6]);   // Temperature °C
                const deadtimeUs= parseFloat(cols[7]) || 0;  // Dead time μs
                const coincident= parseInt(cols[8]) || 0;

                if (isNaN(detTs) || isNaN(sipmMv)) continue;

                // ─ Compute wall-clock time ──────────────────────────────
                if (firstDetTs === null) firstDetTs = detTs;

                let wallMs;
                if (logStartDate) {
                    // Anchor: header start date + elapsed detector ms
                    wallMs = logStartDate.getTime() + (detTs - firstDetTs);
                } else if (filenameDate) {
                    // Fallback: date from filename + elapsed detector ms
                    wallMs = filenameDate.getTime() + (detTs - firstDetTs);
                } else {
                    // Final fallback: today midnight + elapsed detector ms
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    wallMs = today.getTime() + (detTs - firstDetTs);
                }

                if (startDateMs === null) startDateMs = wallMs;
                endDateMs = wallMs;

                // ─ Aggregate into minute bucket ─────────────────────────
                const minuteKey = String(Math.floor(wallMs / 60000) * 60);  // unix seconds

                if (!minutes[minuteKey]) {
                    minutes[minuteKey] = {
                        ec: 0, cc: 0,
                        sipmSum: 0, sipmMin: Infinity, sipmMax: -Infinity,
                        tempSum: 0, tempN: 0,
                        prSum: 0, prN: 0,
                        dtSum: 0, dtN: 0
                    };
                }
                const m = minutes[minuteKey];
                m.ec++;
                m.cc += coincident;
                m.sipmSum += sipmMv;
                m.sipmMin = Math.min(m.sipmMin, sipmMv);
                m.sipmMax = Math.max(m.sipmMax, sipmMv);
                if (!isNaN(tempC))     { m.tempSum += tempC;     m.tempN++; }
                if (!isNaN(pressureP)) { m.prSum   += pressureP; m.prN++;   }
                m.dtSum += deadtimeUs / 1000000;  // μs → ratio
                m.dtN++;

                totalEvents++;

                // ─ Yield to UI ──────────────────────────────────────────
                if (linesSinceYield >= LINES_PER_YIELD) {
                    linesSinceYield = 0;
                    _bar(Math.min(48, Math.floor(48 * (totalLines / (file.size / 70)))));
                    _updateStep(`Parsing… ${totalEvents.toLocaleString()} events (${totalLines.toLocaleString()} lines)`);
                    await _tick();
                }
            }
        }

        // Flush decoder
        if (readable.cancel) {
            // noop — we already read all
        }
        // Process last partial line in buffer
        if (buffer.trim()) {
            const cols = buffer.trim().split(/[\t ]+/);
            if (cols.length >= 7) {
                const detTs = parseFloat(cols[1]);
                const sipmMv = parseFloat(cols[4]);
                if (!isNaN(detTs) && !isNaN(sipmMv)) {
                    const pressureP = parseFloat(cols[5]);
                    const tempC = parseFloat(cols[6]);
                    const deadtimeUs = parseFloat(cols[7]) || 0;
                    const coincident = parseInt(cols[8]) || 0;
                    if (firstDetTs === null) firstDetTs = detTs;
                    let wallMs;
                    if (logStartDate) wallMs = logStartDate.getTime() + (detTs - firstDetTs);
                    else if (filenameDate) wallMs = filenameDate.getTime() + (detTs - firstDetTs);
                    else { const td = new Date(); td.setHours(0,0,0,0); wallMs = td.getTime() + (detTs - firstDetTs); }
                    const minuteKey = String(Math.floor(wallMs / 60000) * 60);
                    if (!minutes[minuteKey]) minutes[minuteKey] = { ec:0, cc:0, sipmSum:0, sipmMin:Infinity, sipmMax:-Infinity, tempSum:0, tempN:0, prSum:0, prN:0, dtSum:0, dtN:0 };
                    const m = minutes[minuteKey];
                    m.ec++; m.cc += coincident; m.sipmSum += sipmMv;
                    m.sipmMin = Math.min(m.sipmMin, sipmMv); m.sipmMax = Math.max(m.sipmMax, sipmMv);
                    if (!isNaN(tempC)) { m.tempSum += tempC; m.tempN++; }
                    if (!isNaN(pressureP)) { m.prSum += pressureP; m.prN++; }
                    m.dtSum += deadtimeUs / 1000000; m.dtN++;
                    totalEvents++;
                }
            }
        }

        // ── Finalize minute objects (averages, not sums) ────────────────
        for (const [key, m] of Object.entries(minutes)) {
            minutes[key] = {
                ec: m.ec,
                cc: m.cc,
                sm: m.ec > 0 ? Math.round(m.sipmSum / m.ec * 10) / 10 : 0,
                sn: m.sipmMin === Infinity  ? 0 : Math.round(m.sipmMin * 10) / 10,
                sx: m.sipmMax === -Infinity ? 0 : Math.round(m.sipmMax * 10) / 10,
                tp: m.tempN > 0 ? Math.round(m.tempSum / m.tempN * 10) / 10 : null,
                pr: m.prN   > 0 ? Math.round(m.prSum / m.prN) : null,
                dt: m.dtN   > 0 ? Math.round(m.dtSum / m.dtN * 1000) / 1000 : null
            };
        }

        return {
            minutes,
            totalEvents,
            totalLines,
            startDateISO: startDateMs ? new Date(startDateMs).toISOString() : null,
            endDateISO:   endDateMs   ? new Date(endDateMs).toISOString()   : null
        };
    }

    /* ═══════════════════════════════════════════════════════════════════
       DUPLICATE DETECTION
       ═══════════════════════════════════════════════════════════════════ */

    /** Return a Set of all existing minute-timestamp keys (strings) in a profile. */
    async function _getExistingTimestamps(profileId) {
        const db = FirebaseManager.getDb();
        const snap = await db.ref(`profiles/${profileId}/sessions`).once('value');
        const sessions = snap.val() || {};
        const existing = new Set();
        for (const s of Object.values(sessions)) {
            if (s.minutes) {
                for (const ts of Object.keys(s.minutes)) existing.add(ts);
            }
        }
        return existing;
    }

    /** Ask the user how to handle duplicate minutes.  Returns 'upload' | 'existing' | 'cancel'. */
    function _askDuplicateResolution(dupeCount, totalCount) {
        return new Promise(resolve => {
            const id = 'dupeResolveModal';
            const pct = Math.round(dupeCount / totalCount * 100);

            const modal = _overlay(id, `
                <h2 style="color:var(--text-primary);margin-bottom:12px">⚠ Duplicate Minutes Found</h2>
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;line-height:1.6">
                    <strong style="color:#e5a00d">${dupeCount.toLocaleString()}</strong> of ${totalCount.toLocaleString()} minutes (${pct}%) already exist in this profile.
                    <br>How do you want to handle the overlapping data?
                </p>
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
                    <label style="display:flex;align-items:flex-start;gap:10px;background:var(--bg-tertiary);padding:12px;border-radius:8px;border:1px solid var(--border-color);cursor:pointer">
                        <input type="radio" name="dupeChoice" value="upload" checked style="margin-top:3px">
                        <div>
                            <div style="font-weight:600;color:var(--text-primary);font-size:13px">Keep UPLOADED data</div>
                            <div style="font-size:11px;color:var(--text-secondary)">Overwrite existing minutes with the new uploaded data</div>
                        </div>
                    </label>
                    <label style="display:flex;align-items:flex-start;gap:10px;background:var(--bg-tertiary);padding:12px;border-radius:8px;border:1px solid var(--border-color);cursor:pointer">
                        <input type="radio" name="dupeChoice" value="existing" style="margin-top:3px">
                        <div>
                            <div style="font-weight:600;color:var(--text-primary);font-size:13px">Keep EXISTING data</div>
                            <div style="font-size:11px;color:var(--text-secondary)">Skip duplicate minutes, only upload new ones</div>
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button id="dupeCancelBtn" style="padding:8px 18px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:13px">Cancel Upload</button>
                    <button id="dupeConfirmBtn" style="padding:8px 18px;border:none;border-radius:6px;background:linear-gradient(135deg,#00d4ff,#7b2cbf);color:#fff;cursor:pointer;font-weight:600;font-size:13px">Continue</button>
                </div>
            `);
            document.body.appendChild(modal);

            document.getElementById('dupeConfirmBtn').onclick = () => {
                const val = document.querySelector('input[name="dupeChoice"]:checked')?.value || 'upload';
                modal.remove();
                resolve(val);
            };
            document.getElementById('dupeCancelBtn').onclick = () => {
                modal.remove();
                resolve('cancel');
            };
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       UPLOAD TO FIREBASE — BATCHED
       ═══════════════════════════════════════════════════════════════════ */

    async function _uploadToFirebase(profileId, sessionId, minutes, filename, totalEvents, onProgress) {
        const db = FirebaseManager.getDb();
        const basePath = `profiles/${profileId}/sessions/${sessionId}`;

        // Write session metadata first
        const timestamps = Object.keys(minutes).map(Number).sort((a, b) => a - b);
        const startTs = timestamps[0] * 1000;
        const endTs   = timestamps[timestamps.length - 1] * 1000;

        await db.ref(basePath).update({
            startTime: startTs,
            endTime:   endTs,
            name:      `Upload ${new Date(startTs).toLocaleString()}`,
            status:    'completed',
            meta: {
                uploaded_at:   new Date().toISOString(),
                source_file:   filename,
                total_events:  totalEvents,
                total_minutes: timestamps.length
            }
        });

        // Upload minutes in batches
        const entries = Object.entries(minutes);
        let uploaded = 0;

        for (let i = 0; i < entries.length; i += UPLOAD_BATCH_SIZE) {
            if (_aborted) throw new Error('Aborted by user');

            const batch = {};
            const slice = entries.slice(i, i + UPLOAD_BATCH_SIZE);
            for (const [ts, data] of slice) {
                batch[`minutes/${ts}`] = data;
            }

            await db.ref(basePath).update(batch);
            uploaded += slice.length;
            onProgress(uploaded / entries.length);

            _updateStep(`Uploading… ${uploaded.toLocaleString()} / ${entries.length.toLocaleString()} minutes`);
            await _tick();
        }
    }

    /* ═══════════════════════════════════════════════════════════════════
       HELPERS
       ═══════════════════════════════════════════════════════════════════ */

    /** Generate a session ID from the first minute timestamp. */
    function _generateSessionId(minutes) {
        const first = Object.keys(minutes).map(Number).sort((a, b) => a - b)[0];
        if (!first) return `upload_${Date.now()}`;
        const d = new Date(first * 1000);
        return `${d.getFullYear()}${_pad(d.getMonth() + 1)}${_pad(d.getDate())}_${_pad(d.getHours())}${_pad(d.getMinutes())}${_pad(d.getSeconds())}`;
    }

    /** Extract a date from a filename like "serial-log-2026-01-30.txt" or "30-01-2026.log" */
    function _dateFromFilename(name) {
        // ISO-like: YYYY-MM-DD
        let m = name.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
        // DD-MM-YYYY
        m = name.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
        return null;
    }

    /** Get profile name from ProfileManager cache. */
    function _profileName(profileId) {
        if (typeof ProfileManager !== 'undefined' && ProfileManager.getAllProfiles) {
            const p = ProfileManager.getAllProfiles()[profileId];
            if (p) return p.name || p.meta?.name || profileId;
        }
        return profileId;
    }

    /** Format a timestamp (ms or seconds) to a human-readable string. */
    function _fmtDate(ts) {
        // Auto-detect seconds vs ms
        if (ts < 1e12) ts *= 1000;
        return new Date(ts).toLocaleString();
    }

    function _esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
    function _pad(n) { return String(n).padStart(2, '0'); }
    function _tick() { return new Promise(r => setTimeout(r, 0)); }

    /** Read entire file as text (fallback for old browsers). */
    function _readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read file'));
            reader.readAsText(file);
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       PROGRESS UI
       ═══════════════════════════════════════════════════════════════════ */

    function _showProgress(title) {
        _closeProgress();
        _progressEl = document.createElement('div');
        _progressEl.id = 'sessionUploadProgress';
        _progressEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10001';
        _progressEl.innerHTML = `
        <div style="background:var(--bg-secondary,#1a1a2e);border:2px solid #00d4ff;border-radius:12px;padding:30px;width:92%;max-width:640px;max-height:82vh;overflow-y:auto">
            <h2 style="color:#00d4ff;margin:0 0 18px;font-size:17px">${_esc(title)}</h2>
            <div id="sessUploadSteps" style="font-family:monospace;font-size:12px;line-height:1.8"></div>
            <div style="margin-top:18px;background:#2d2d44;border-radius:6px;height:26px;overflow:hidden;position:relative">
                <div id="sessUploadBar" style="background:linear-gradient(90deg,#00d4ff,#00ff88);height:100%;width:0%;transition:width 0.3s;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#1a1a2e"></div>
            </div>
            <div id="sessUploadStatus" style="margin-top:12px;padding:10px;background:#2d2d44;border-radius:6px;font-size:12px;color:#8b949e;display:none"></div>
            <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
                <button id="sessAbortBtn" onclick="SessionManager._abort()" style="padding:8px 18px;border:1px solid #f85149;border-radius:6px;background:transparent;color:#f85149;cursor:pointer;font-size:12px">Cancel</button>
                <button id="sessCloseBtn" onclick="SessionManager.closeProgress()" style="display:none;padding:8px 18px;border:none;border-radius:6px;background:#00ff88;color:#1a1a2e;cursor:pointer;font-weight:bold;font-size:12px">Close</button>
            </div>
        </div>`;
        document.body.appendChild(_progressEl);
    }

    function _step(icon, text, cls) {
        const div = document.getElementById('sessUploadSteps');
        if (!div) return;
        const el = document.createElement('div');
        el.style.color = cls === 'error' ? '#ff4444' : cls === 'success' ? '#00ff88' : '#fff';
        el.textContent = `${icon} ${text}`;
        el.dataset.isStep = 'true';
        div.appendChild(el);
        div.scrollTop = div.scrollHeight;
    }

    /** Update the last "in-progress" step instead of adding new ones (avoids log spam). */
    function _updateStep(text) {
        const div = document.getElementById('sessUploadSteps');
        if (!div) return;
        const children = div.querySelectorAll('[data-is-step]');
        const last = children[children.length - 1];
        if (last && last.textContent.startsWith('⏳') || last && last.textContent.startsWith('🔄')) {
            last.textContent = `🔄 ${text}`;
        } else {
            const el = document.createElement('div');
            el.style.color = '#fff';
            el.textContent = `🔄 ${text}`;
            el.dataset.isStep = 'true';
            div.appendChild(el);
        }
        div.scrollTop = div.scrollHeight;
    }

    function _bar(pct) {
        const el = document.getElementById('sessUploadBar');
        if (el) { el.style.width = Math.min(100, pct) + '%'; el.textContent = Math.min(100, pct) + '%'; }
    }

    function _result(ok, msg, details) {
        _step(ok ? '✅' : '❌', msg, ok ? 'success' : 'error');
        const statusEl = document.getElementById('sessUploadStatus');
        if (details && statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = details; }
        _showCloseBtn();
    }

    function _showCloseBtn() {
        const close = document.getElementById('sessCloseBtn');
        const abort = document.getElementById('sessAbortBtn');
        if (close) close.style.display = '';
        if (abort) abort.style.display = 'none';
    }

    function _abort() { _aborted = true; }

    function closeProgress() {
        if (_progressEl) { _progressEl.remove(); _progressEl = null; }
    }

    function _closeProgress() { closeProgress(); }

    function _overlay(id, inner) {
        const d = document.createElement('div');
        d.className = 'modal-overlay';
        d.id = id;
        d.innerHTML = `<div class="modal-content" style="max-width:640px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px">${inner}</div>`;
        return d;
    }

    function closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.remove();
    }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        showSessionsModal,
        downloadSession,
        deleteSession,
        triggerUpload,
        closeModal,
        closeProgress,
        _abort          // exposed for onclick
    });
})();
