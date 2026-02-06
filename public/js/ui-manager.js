/**
 * MuNRa 4.0 - UI Manager
 * 
 * Owns toast notifications, connection-status indicator, theme toggle,
 * settings modal, custom-range picker, mode labels, and storage stats.
 * 
 * Depends on: config.js, firebase-manager.js, data-manager.js, chart-manager.js
 */

const UIManager = (() => {

    // ─── Toast ──────────────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.textContent = message;
        container.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // ─── Connection Status ──────────────────────────────────────────────
    function setConnectionStatus(status, text) {
        const el = document.getElementById('connectionStatus');
        el.className = 'status-indicator ' + status;
        el.querySelector('.status-text').textContent = text;
    }

    // ─── Theme ──────────────────────────────────────────────────────────
    let _isLight = false;

    function initTheme() {
        _isLight = localStorage.getItem('munra_theme') === 'light';
        _applyTheme();
    }

    function toggleTheme() {
        _isLight = !_isLight;
        localStorage.setItem('munra_theme', _isLight ? 'light' : 'dark');
        _applyTheme();
    }

    function _applyTheme() {
        document.body.setAttribute('data-theme', _isLight ? 'light' : '');
        document.querySelector('.sun-icon').style.display = _isLight ? 'none' : 'block';
        document.querySelector('.moon-icon').style.display = _isLight ? 'block' : 'none';
    }

    // ─── Mode Labels ────────────────────────────────────────────────────
    function updateModeLabels() {
        const stacked = ChartManager.isStacked();
        document.getElementById('accurateLabel').classList.toggle('active', !stacked);
        document.getElementById('stackedLabel').classList.toggle('active', stacked);
    }

    // ─── Time-Button Highlight ──────────────────────────────────────────
    function highlightTimeButton(range) {
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.range === String(range));
        });
    }

    // ─── Settings Modal ─────────────────────────────────────────────────
    function openSettings() {
        _updateSettingsPermissions();
        document.getElementById('settingsModal').classList.add('active');
        updateStorageStats();
    }

    function closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    function _updateSettingsPermissions() {
        const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin();
        const isLogged = typeof isLoggedIn === 'function' && isLoggedIn();

        const show = (id, v) => { const e = document.getElementById(id); if (e) e.style.display = v ? 'block' : 'none'; };

        if (isAdmin) {
            show('userDatabaseOptions', false);
            show('adminDatabaseOptions', true);
            show('dataManagementGroup', true);
            show('databaseSettingGroup', true);
            show('applyFirebaseBtnUser', false);
            show('connectionResultUser', false);
            show('cmdLinkGroup', true);
        } else if (isLogged) {
            show('userDatabaseOptions', true);
            show('adminDatabaseOptions', false);
            show('dataManagementGroup', true);
            show('databaseSettingGroup', true);
            show('applyFirebaseBtnUser', true);
            show('connectionResultUser', true);
            show('cmdLinkGroup', true);
        } else {
            show('databaseSettingGroup', false);
            show('dataManagementGroup', false);
            show('cmdLinkGroup', false);
        }

        // Populate current URL
        const saved = localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
        const urlInput = document.getElementById('firebaseUrl');
        if (urlInput) urlInput.value = saved;

        const choice = document.getElementById('databaseChoice');
        const custom = document.getElementById('userCustomUrl');
        if (choice && custom) {
            if (saved === DEFAULT_FIREBASE_URL) {
                choice.value = 'default'; custom.style.display = 'none';
            } else {
                choice.value = 'custom'; custom.value = saved; custom.style.display = 'block';
            }
        }
    }

    // ─── Firebase URL Apply ─────────────────────────────────────────────
    function applyFirebaseUrl(isAdmin) {
        const resultId = isAdmin ? 'connectionResult' : 'connectionResultUser';
        const result = document.getElementById(resultId);
        let url = '';

        if (isAdmin) {
            url = document.getElementById('firebaseUrl').value.trim();
        } else {
            const choice = document.getElementById('databaseChoice')?.value;
            url = choice === 'default' ? DEFAULT_FIREBASE_URL : (document.getElementById('userCustomUrl')?.value.trim());
        }

        if (!url) { result.textContent = 'Enter a URL'; result.className = 'connection-result error'; return; }
        result.textContent = 'Connecting…'; result.className = 'connection-result';
        localStorage.setItem('munra_firebase_url', url);

        FirebaseManager.init(url).then(() => {
            result.textContent = 'Connected!'; result.className = 'connection-result success';
            ProfileManager.loadProfiles();
            updateStorageStats();
        }).catch(e => {
            result.textContent = 'Failed: ' + e.message; result.className = 'connection-result error';
        });
    }

    // ─── Database Migration ─────────────────────────────────────────────
    function showMigrateModal() {
        const currentUrl = localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay'; modal.id = 'migrateDbModal';
        modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px">
            <h2 style="margin-bottom:10px;color:var(--text-primary)">Database Migration</h2>
            <div style="background:#f8d7da;border:2px solid #f5c2c7;border-radius:8px;padding:15px;margin-bottom:15px">
                <h3 style="color:#842029;margin:0 0 10px">⚠ CRITICAL OPERATION</h3>
                <p style="color:#842029;font-size:13px;margin:0">This copies ALL data. Cannot be undone. Verify destination URL.</p>
            </div>
            <div style="margin-bottom:15px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">Source (current):</label>
                <input type="text" value="${currentUrl}" disabled style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);font-size:12px">
            </div>
            <div style="margin-bottom:15px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">Destination URL:</label>
                <input type="text" id="migrateDestUrl" placeholder="https://new-db.firebaseio.com/"
                    style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">
            </div>
            <div id="migrateProgress" style="display:none;margin-bottom:15px">
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:15px">
                    <div style="background:var(--bg-secondary);border-radius:4px;height:20px;overflow:hidden">
                        <div id="migrateProgressBar" style="background:linear-gradient(135deg,#00d4ff,#7b2cbf);height:100%;width:0%;transition:width 0.3s"></div>
                    </div>
                    <p id="migrateStatus" style="margin:10px 0 0;color:var(--text-secondary);font-size:12px">Preparing…</p>
                </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button onclick="document.getElementById('migrateDbModal').remove()"
                    style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer">Cancel</button>
                <button onclick="UIManager.executeMigration()" id="startMigrateBtn"
                    style="padding:10px 20px;border:none;border-radius:8px;background:#dc3545;color:white;cursor:pointer;font-weight:600">Start Migration</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    async function executeMigration() {
        const dest = document.getElementById('migrateDestUrl').value.trim();
        if (!dest) { showToast('Enter destination URL', 'error'); return; }
        if (!confirm('FIRST: Migrate ALL data to:\n' + dest + '\n\nContinue?')) return;
        if (!confirm('SECOND: This CANNOT be undone. Proceed?')) return;
        if (prompt('Type "MIGRATE" to confirm:') !== 'MIGRATE') { showToast('Cancelled', 'info'); return; }

        document.getElementById('migrateProgress').style.display = 'block';
        document.getElementById('startMigrateBtn').disabled = true;
        const bar = document.getElementById('migrateProgressBar');
        const status = document.getElementById('migrateStatus');

        try {
            status.textContent = 'Reading source…'; bar.style.width = '10%';
            const data = (await FirebaseManager.getDb().ref('/').once('value')).val() || {};
            bar.style.width = '30%';
            status.textContent = 'Connecting to destination…';

            const destApp = firebase.initializeApp({ ...FIREBASE_CONFIG, databaseURL: dest }, 'migrationDest');
            const destDb = destApp.database();

            const keys = Object.keys(data);
            for (let i = 0; i < keys.length; i++) {
                status.textContent = `Writing ${keys[i]}…`;
                await destDb.ref(keys[i]).set(data[keys[i]]);
                bar.style.width = `${30 + Math.floor(60 * (i + 1) / keys.length)}%`;
            }

            await destApp.delete();
            bar.style.width = '100%';
            status.textContent = 'Migration completed!'; status.style.color = '#2ea043';
            showToast('Migration completed!', 'success');

            if (confirm('Switch to new database now?')) {
                localStorage.setItem('munra_firebase_url', dest);
                location.reload();
            }
        } catch (e) {
            status.textContent = 'Failed: ' + e.message; status.style.color = '#dc3545';
            document.getElementById('startMigrateBtn').disabled = false;
        }
    }

    // ─── Custom Range Picker ────────────────────────────────────────────
    function openCustomRange() {
        const modal = document.getElementById('customRangeModal');
        modal.classList.add('active');

        const allData = DataManager.getAllData();
        if (allData.length) {
            document.getElementById('customStartTime').value = new Date(allData[0].timestamp * 1000).toISOString().slice(0, 16);
            document.getElementById('customEndTime').value   = new Date(allData[allData.length - 1].timestamp * 1000).toISOString().slice(0, 16);
        } else {
            const now = new Date();
            document.getElementById('customStartTime').value = new Date(now - 3600000).toISOString().slice(0, 16);
            document.getElementById('customEndTime').value   = now.toISOString().slice(0, 16);
        }
    }

    function applyCustomRange() {
        const s = document.getElementById('customStartTime').value;
        const e = document.getElementById('customEndTime').value;
        if (!s || !e) { showToast('Select both dates', 'error'); return; }
        const start = new Date(s).getTime(), end = new Date(e).getTime();
        if (start >= end) { showToast('Start must be before end', 'error'); return; }

        ChartManager.setCustomRange(start, end);
        highlightTimeButton('custom');
        document.getElementById('customRangeModal').classList.remove('active');
        showToast('Custom range applied', 'success');
    }

    function closeCustomRange() {
        document.getElementById('customRangeModal').classList.remove('active');
    }

    // ─── Storage Stats ──────────────────────────────────────────────────
    function updateStorageStats() {
        const s = DataManager.getStorageStats();
        document.getElementById('statsMinutes').textContent   = s.minutes.toLocaleString();
        document.getElementById('statsRealtime').textContent  = s.realtime.toLocaleString();
        document.getElementById('statsConnection').textContent = s.connected ? 'Active' : 'Not connected';
    }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        showToast,
        setConnectionStatus,
        initTheme,
        toggleTheme,
        updateModeLabels,
        highlightTimeButton,
        openSettings,
        closeSettings,
        applyFirebaseUrl,
        showMigrateModal,
        executeMigration,
        openCustomRange,
        applyCustomRange,
        closeCustomRange,
        updateStorageStats
    });
})();
