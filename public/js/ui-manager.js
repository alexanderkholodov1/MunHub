/**
 * MunHub 5.0 — UI Manager
 *
 * Toast notifications, connection-status, theme, settings modal,
 * custom-range picker, mode labels.
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
    }

    function closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    function _updateSettingsPermissions() {
        const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin();
        const isLogged = typeof isLoggedIn === 'function' && isLoggedIn();

        const show = (id, v) => { const e = document.getElementById(id); if (e) e.style.display = v ? 'block' : 'none'; };

        if (isAdmin || isLogged) {
            show('databaseSettingGroup', true);
            show('dataManagementGroup', true);
            show('cmdLinkGroup', true);
        } else {
            show('databaseSettingGroup', false);
            show('dataManagementGroup', false);
            show('cmdLinkGroup', false);
        }

        // Populate current URL into user DB choice
        const saved = localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
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
    function applyFirebaseUrl() {
        const result = document.getElementById('connectionResultUser');
        const choice = document.getElementById('databaseChoice')?.value;
        const url = choice === 'default' ? DEFAULT_FIREBASE_URL : (document.getElementById('userCustomUrl')?.value.trim());

        if (!url) { if (result) { result.textContent = 'Enter a URL'; result.className = 'connection-result error'; } return; }
        if (result) { result.textContent = 'Connecting…'; result.className = 'connection-result'; }
        localStorage.setItem('munra_firebase_url', url);

        FirebaseManager.init(url).then(() => {
            if (result) { result.textContent = 'Connected!'; result.className = 'connection-result success'; }
            ProfileManager.loadProfiles();
        }).catch(e => {
            if (result) { result.textContent = 'Failed: ' + e.message; result.className = 'connection-result error'; }
        });
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
        openCustomRange,
        applyCustomRange,
        closeCustomRange
    });
})();
