/**
 * MuNRa 4.0 - Upload Manager
 * 
 * Handles session file uploads (raw MuNRa log, JSON, CSV),
 * profile uploads (JSON), and full data export (CSV).
 * 
 * Shows a progress modal with step-by-step feedback.
 * 
 * Depends on: config.js, firebase-manager.js, data-manager.js, ui-manager.js
 */

const UploadManager = (() => {
    let _modalEl = null;

    // ─── Session File Upload ────────────────────────────────────────────
    function handleSessionFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        const db = FirebaseManager.getDb();
        const profile = DataManager.getCurrentProfile();
        if (!db || !profile) { UIManager.showToast('Select a profile first', 'error'); return; }

        _showProgress(file.name);

        const reader = new FileReader();
        reader.onload = ev => _processSession(ev.target.result, file.name, profile);
        reader.onerror = () => _step('❌', 'Could not read file', 'error');
        reader.readAsText(file);
    }

    async function _processSession(content, filename, profile) {
        const lines = content.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
        const total = lines.length;
        _step('✅', `Read ${total.toLocaleString()} lines`, 'success');
        _bar(10);
        await _tick();

        // JSON?
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
            _step('📋', 'Format: JSON');
            await _uploadJSON(content, filename, profile);
            return;
        }

        // Raw MuNRa log
        const first = lines[0].trim().split(/\s+/);
        if (first.length < 7) {
            _result(false, 'Unrecognised format', `Need ≥7 columns. Got: "${lines[0].substring(0, 80)}"`);
            return;
        }
        _step('✅', `Format: MuNRa events (${first.length} cols)`, 'success');
        _bar(15);

        // Date from filename
        let baseDate;
        const dm = filename.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (dm) {
            baseDate = new Date(+dm[3], +dm[2] - 1, +dm[1]);
            _step('📅', `Date from name: ${dm[1]}/${dm[2]}/${dm[3]}`, 'success');
        } else {
            baseDate = new Date(); baseDate.setHours(0, 0, 0, 0);
            _step('⚠️', 'No date in filename, using today');
        }
        _bar(20); await _tick();

        // Timestamp range
        let minTs = Infinity, maxTs = -Infinity, valid = 0, invalid = 0;
        for (const line of lines) {
            const ts = parseFloat(line.trim().split(/\s+/)[1]);
            if (!isNaN(ts)) { minTs = Math.min(minTs, ts); maxTs = Math.max(maxTs, ts); valid++; }
            else invalid++;
        }
        if (!valid) { _result(false, 'No valid events found'); return; }
        _step('✅', `Valid events: ${valid.toLocaleString()}`, 'success');
        if (invalid) _step('⚠️', `Ignored lines: ${invalid}`);
        _bar(30); await _tick();

        // Aggregate by minute
        _step('🔄', 'Aggregating by minute…');
        const baseSec = Math.floor(baseDate.getTime() / 1000);
        const range = maxTs - minTs;
        const minutes = {};
        const interval = Math.max(1, Math.floor(total / 20));

        for (let i = 0; i < lines.length; i++) {
            const p = lines[i].trim().split(/\s+/);
            if (p.length < 7) continue;
            const rel = parseFloat(p[1]);
            if (isNaN(rel)) continue;

            const norm = range > 0 ? (rel - minTs) / range : 0;
            const absSec = baseSec + Math.floor(norm * 86400);
            const mKey = Math.floor(absSec / 60) * 60;

            const sipm = parseFloat(p[2]) || 0;
            const pressure = parseFloat(p[5]) || 0;
            const temp = parseFloat(p[6]) || 0;
            const deadtime = parseFloat(p[7]) || 0;

            if (!minutes[mKey]) {
                minutes[mKey] = { ts: mKey, ec: 0, cc: 0, sipmSum: 0, sipmMin: Infinity, sipmMax: -Infinity, tp: temp, pr: pressure, dtSum: 0 };
            }
            const m = minutes[mKey];
            m.ec++; m.cc++;
            m.sipmSum += sipm;
            m.sipmMin = Math.min(m.sipmMin, sipm);
            m.sipmMax = Math.max(m.sipmMax, sipm);
            m.tp = temp; m.pr = pressure; m.dtSum += deadtime;

            if (i % interval === 0) { _bar(30 + Math.floor(40 * i / total)); await _tick(); }
        }

        _bar(70);
        const mCount = Object.keys(minutes).length;
        _step('✅', `${valid.toLocaleString()} events → ${mCount.toLocaleString()} minutes`, 'success');
        await _tick();

        // Build final minute objects (AVERAGES, not sums)
        const finalMinutes = {};
        const sorted = Object.values(minutes).sort((a, b) => a.ts - b.ts);
        for (const m of sorted) {
            finalMinutes[m.ts] = {
                ts: m.ts,
                ts_iso: new Date(m.ts * 1000).toISOString(),
                ec: m.ec, cc: m.cc,
                sm: m.ec > 0 ? Math.round(m.sipmSum / m.ec * 10) / 10 : 0,
                sn: m.sipmMin === Infinity ? 0 : m.sipmMin,
                sx: m.sipmMax === -Infinity ? 0 : m.sipmMax,
                tp: m.tp, pr: m.pr,
                dt: Math.round(m.dtSum)
            };
        }

        // Session ID from first timestamp
        const d = new Date(sorted[0].ts * 1000);
        const sid = `${d.getFullYear()}${_pad(d.getMonth() + 1)}${_pad(d.getDate())}_${_pad(d.getHours())}${_pad(d.getMinutes())}${_pad(d.getSeconds())}`;
        _step('📁', `Session: ${sid}`);
        _bar(80);

        // Upload
        _step('☁️', 'Uploading to Firebase…');
        try {
            const ref = FirebaseManager.getDb().ref(`profiles/${profile}/sessions/${sid}`);
            await ref.set({
                meta: { uploaded_at: new Date().toISOString(), source_file: filename, total_events: valid, total_minutes: mCount },
                minutes: finalMinutes
            });
            _bar(95);
            _step('🔍', 'Verifying…');
            const v = (await ref.once('value')).val();
            _bar(100);
            if (v?.minutes && Object.keys(v.minutes).length === mCount) {
                _step('✅', `Verified: ${mCount} minutes`, 'success');
                _result(true, 'Upload completed!', `Events: ${valid.toLocaleString()}<br>Minutes: ${mCount}<br>Session: ${sid}<br>File: ${filename}`);
            } else {
                _result(true, 'Partial upload', 'Verification count mismatch');
            }
        } catch (err) {
            _step('❌', err.message, 'error');
            _result(false, 'Upload failed', err.message);
        }
    }

    // ─── JSON Upload ────────────────────────────────────────────────────
    async function _uploadJSON(content, filename, profile) {
        try {
            const json = JSON.parse(content);
            let data = [];
            if (json.minutes && typeof json.minutes === 'object') data = Object.values(json.minutes);
            else if (Array.isArray(json)) data = json;
            else data = [json];

            _step('✅', `${data.length} entries`, 'success');
            _bar(50);

            const valid = data.filter(d => d.ts || d.timestamp);
            valid.forEach(d => { if (!d.ts && d.timestamp) d.ts = d.timestamp; });
            if (!valid.length) { _result(false, 'No entries with valid timestamps'); return; }

            const d = new Date(valid[0].ts * 1000);
            const sid = `${d.getFullYear()}${_pad(d.getMonth() + 1)}${_pad(d.getDate())}_${_pad(d.getHours())}${_pad(d.getMinutes())}${_pad(d.getSeconds())}`;

            const mins = {};
            valid.forEach(e => { mins[e.ts.toString()] = e; });
            _bar(70);
            _step('☁️', 'Uploading…');

            const ref = FirebaseManager.getDb().ref(`profiles/${profile}/sessions/${sid}`);
            await ref.set({ meta: { uploaded_at: new Date().toISOString(), source_file: filename, total_minutes: valid.length }, minutes: mins });
            _bar(95);
            const v = (await ref.once('value')).val();
            _bar(100);
            if (v?.minutes) {
                _result(true, 'JSON uploaded', `${valid.length} minutes as ${sid}`);
            } else {
                _result(false, 'Verification failed');
            }
        } catch (err) {
            _result(false, 'JSON processing error', err.message);
        }
    }

    // ─── Profile Upload ─────────────────────────────────────────────────
    function handleProfileFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        if (!FirebaseManager.getDb()) { UIManager.showToast('Not connected', 'error'); return; }

        if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = ev => _processProfileJSON(ev.target.result, file.name);
            reader.onerror = () => UIManager.showToast('Read error', 'error');
            reader.readAsText(file);
        } else {
            UIManager.showToast('Only JSON supported', 'error');
        }
    }

    async function _processProfileJSON(content, filename) {
        _showProgress(filename);
        let json;
        try { json = JSON.parse(content); _step('✅', 'Valid JSON', 'success'); }
        catch (e) { _result(false, 'Invalid JSON', e.message); return; }
        _bar(20);

        let pid, pContent;
        if (json.meta || json.sessions || json.name) {
            const input = prompt('Profile ID for import:', 'imported_profile');
            if (!input) { _closeProgress(); return; }
            pid = input.toLowerCase().replace(/[^a-z0-9]/g, '_');
            pContent = json;
        } else {
            const keys = Object.keys(json);
            if (keys.length === 1) { pid = keys[0]; pContent = json[pid]; }
            else {
                const choice = prompt(`Profiles: ${keys.join(', ')}\nEnter ID or "all":`);
                if (!choice) { _closeProgress(); return; }
                if (choice.toLowerCase() === 'all') {
                    for (const k of keys) {
                        _step('☁️', `Uploading ${k}…`);
                        await FirebaseManager.getDb().ref(`profiles/${k}`).set(json[k]);
                        _step('✅', `${k} done`, 'success');
                    }
                    _bar(100);
                    _result(true, `${keys.length} profiles imported`);
                    ProfileManager.loadProfiles();
                    return;
                }
                if (!json[choice]) { _result(false, `"${choice}" not found`); return; }
                pid = choice; pContent = json[choice];
            }
        }

        _bar(40);
        const sessions = pContent.sessions || {};
        let totalMin = 0;
        for (const s of Object.values(sessions)) { if (s.minutes) totalMin += Object.keys(s.minutes).length; }
        _step('📊', `${Object.keys(sessions).length} sessions, ${totalMin} minutes`, 'success');

        const exists = (await FirebaseManager.getDb().ref(`profiles/${pid}`).once('value')).val();
        if (exists && !confirm(`"${pid}" exists. Overwrite?`)) { _closeProgress(); return; }

        _step('☁️', 'Uploading…'); _bar(60);
        if (!pContent.name && !pContent.meta) { pContent.name = pid; pContent.meta = { name: pid, imported_at: new Date().toISOString() }; }
        await FirebaseManager.getDb().ref(`profiles/${pid}`).set(pContent);
        _bar(100);
        _result(true, 'Profile imported', `${pid} — ${totalMin} minutes`);
        ProfileManager.loadProfiles();
        setTimeout(() => { document.getElementById('profileSelect').value = pid; ProfileManager.selectProfile(pid); }, 400);
    }

    // ─── Export ──────────────────────────────────────────────────────────
    function exportAll() {
        const data = DataManager.getAllData();
        if (!data.length) { UIManager.showToast('No data', 'error'); return; }

        let csv = 'Timestamp,DateTime,Session,Events,Muons,Temperature,Pressure,SiPM_Avg,SiPM_Min,SiPM_Max,DeadTime\n';
        for (const d of data) {
            csv += `${d.timestamp},${new Date(d.timestamp * 1000).toISOString()},${d.session || ''},`;
            csv += `${d.ec || ''},${d.cc || ''},${d.tp || ''},${d.pr || ''},`;
            csv += `${d.sm || ''},${d.sn || ''},${d.sx || ''},${d.dt || ''}\n`;
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `munra_export_${DataManager.getCurrentProfile()}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        UIManager.showToast('Data exported', 'success');
    }

    // ─── Progress Modal Helpers ─────────────────────────────────────────
    function _showProgress(name) {
        _closeProgress();
        _modalEl = document.createElement('div');
        _modalEl.id = 'uploadProgressModal';
        _modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000';
        _modalEl.innerHTML = `
        <div style="background:#1a1a2e;border:2px solid #00d4ff;border-radius:12px;padding:30px;width:90%;max-width:600px;max-height:80vh;overflow-y:auto">
            <h2 style="color:#00d4ff;margin:0 0 20px;font-size:18px">Processing: ${name}</h2>
            <div id="uploadSteps" style="font-family:monospace;font-size:13px;line-height:1.8">
                <div style="color:#fff">⏳ Reading file…</div>
            </div>
            <div style="margin-top:20px;background:#2d2d44;border-radius:6px;height:24px;overflow:hidden">
                <div id="uploadProgressFill" style="background:linear-gradient(90deg,#00d4ff,#00ff88);height:100%;width:0%;transition:width 0.3s;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#1a1a2e"></div>
            </div>
            <div id="uploadStatus" style="margin-top:15px;padding:10px;background:#2d2d44;border-radius:6px;font-size:12px;color:#8b949e;display:none"></div>
            <button id="uploadCloseBtn" onclick="UploadManager.closeProgress()" style="display:none;margin-top:20px;width:100%;padding:12px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer">Close</button>
        </div>`;
        document.body.appendChild(_modalEl);
    }

    function _step(icon, text, cls = '') {
        const div = document.getElementById('uploadSteps');
        if (!div) return;
        const el = document.createElement('div');
        el.style.color = cls === 'error' ? '#ff4444' : cls === 'success' ? '#00ff88' : '#fff';
        el.textContent = `${icon} ${text}`;
        div.appendChild(el);
        div.scrollTop = div.scrollHeight;
    }

    function _bar(pct) {
        const el = document.getElementById('uploadProgressFill');
        if (el) { el.style.width = pct + '%'; el.textContent = pct + '%'; }
    }

    function _result(ok, msg, details) {
        _step(ok ? '✅' : '❌', msg, ok ? 'success' : 'error');
        const statusEl = document.getElementById('uploadStatus');
        if (details && statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = details; }
        const btn = document.getElementById('uploadCloseBtn');
        if (btn) { btn.style.display = 'block'; btn.style.background = ok ? '#00ff88' : '#ff4444'; }
    }

    function _closeProgress() { if (_modalEl) { _modalEl.remove(); _modalEl = null; } }
    function closeProgress() { _closeProgress(); }

    function _tick() { return new Promise(r => setTimeout(r, 0)); }
    function _pad(n) { return String(n).padStart(2, '0'); }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        handleSessionFile,
        handleProfileFile,
        exportAll,
        closeProgress
    });
})();
