/**
 * MuNRa 4.8.1 — Entry Point / Orchestrator
 *
 * Wires IIFE modules + DOM listeners.  NO business logic here.
 *
 * v4.2 changes:
 *   - Sidebar removed → overlay profile panel
 *   - Chart source selectors (per-slot dropdown)
 *   - Detector setup modal flow
 *   - Buttons use data-slot (not data-chart)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── 0. Global bridges ──────────────────────────────────────────────
    window.showToast = UIManager.showToast;

    // ── 1. Preferences ─────────────────────────────────────────────────
    const savedStacked = localStorage.getItem('munra_stacked') === 'true';
    const savedRange   = localStorage.getItem('munra_range');

    document.getElementById('modeSwitch').checked = savedStacked;
    UIManager.updateModeLabels(savedStacked);
    UIManager.initTheme();

    // Restore Firebase URL
    const savedUrl = localStorage.getItem('munra_firebase_url');
    const urlInput = document.getElementById('firebaseUrl');
    if (urlInput) urlInput.value = savedUrl || FIREBASE_CONFIG.databaseURL;

    // ── 2. Firebase + Charts ───────────────────────────────────────────
    FirebaseManager.init().then(() => ProfileManager.loadProfiles());
    ChartManager.init();

    ChartManager.setStackedMode(savedStacked);
    const range = savedRange === 'all' || savedRange === 'custom'
        ? savedRange : parseInt(savedRange) || 15;
    ChartManager.setTimeRange(range);
    UIManager.highlightTimeButton(range);

    // ── 3. Data → Chart pipeline ───────────────────────────────────────
    DataManager.onChange(() => {
        ChartManager.scheduleUpdate();
        _updateRealtimeButtonStates();
    });
    DataManager.onRealtimeChange(() => {
        // Only trigger chart updates for realtime ranges (1m, 5m) to avoid unnecessary redraws
        const range = ChartManager.getTimeRange();
        if (range === 1 || range === 5) ChartManager.scheduleUpdate();
        _updateRealtimeButtonStates();
    });

    /** Disable 1m/5m buttons when no realtime data or data is stale (>5 min old) */
    function _updateRealtimeButtonStates() {
        const hasRT = DataManager.hasRealtimeData();
        const expired = DataManager.isRealtimeExpired ? DataManager.isRealtimeExpired() : false;
        const available = hasRT && !expired;
        document.querySelectorAll('.time-btn').forEach(btn => {
            const r = btn.dataset.range;
            if (r === '1' || r === '5') {
                btn.classList.toggle('rt-disabled', !available);
                btn.title = available ? '' : (expired ? 'Real-time data is stale (>5 min). Reconnect detector.' : 'Enable real-time data when connecting a detector');
            }
        });
        // If currently on 1m/5m and RT expired, auto-switch to 15m
        if (expired) {
            const curRange = ChartManager.getTimeRange();
            if (curRange === 1 || curRange === 5) {
                UIManager.showToast('Real-time data expired. Switching to 15m view.', 'info');
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                const btn15 = document.querySelector('.time-btn[data-range="15"]');
                if (btn15) btn15.classList.add('active');
                ChartManager.setTimeRange(15);
            }
        }
    }

    // ── 4. Restore slot sources from localStorage ──────────────────────
    for (let s = 0; s < 4; s++) {
        const saved = localStorage.getItem(`munra_slot${s}_source`);
        if (saved) {
            const sel = document.querySelector(`.chart-source-select[data-slot="${s}"]`);
            if (sel) sel.value = saved;
            // If it differs from the default, apply it
            const defaults = ['events', 'sipm', 'temp', 'deadtime'];
            if (saved !== defaults[s]) {
                ChartManager.setSlotSource(s, saved);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════

    // ── Profile overlay panel ──────────────────────────────────────────
    const profilePanel    = document.getElementById('profilePanel');
    const profileBackdrop = document.getElementById('profileBackdrop');
    const profilesBtn     = document.getElementById('profilesBtn');
    const profilePanelClose = document.getElementById('profilePanelClose');

    function openProfilePanel() {
        profilePanel.classList.add('open');
        profileBackdrop.classList.add('open');
    }
    function closeProfilePanel() {
        profilePanel.classList.remove('open');
        profileBackdrop.classList.remove('open');
    }
    if (profilesBtn) profilesBtn.addEventListener('click', openProfilePanel);
    if (profilePanelClose) profilePanelClose.addEventListener('click', closeProfilePanel);
    if (profileBackdrop) profileBackdrop.addEventListener('click', closeProfilePanel);

    // ── Tree section collapse/expand ───────────────────────────────────
    document.querySelectorAll('.tree-section-head').forEach(head => {
        head.addEventListener('click', () => head.closest('.tree-section').classList.toggle('open'));
    });

    // ── Profile search ─────────────────────────────────────────────────
    const profileSearch = document.getElementById('profileSearch');
    if (profileSearch) {
        profileSearch.addEventListener('input', e => ProfileManager.filterProfiles(e.target.value));
    }

    // ── Chart source selectors (data-slot dropdown) ────────────────────
    document.querySelectorAll('.chart-source-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const slot = parseInt(sel.dataset.slot);
            ChartManager.setSlotSource(slot, sel.value);
        });
    });

    // ── Chart type cycling & download (data-slot) ──────────────────────
    document.querySelectorAll('.chart-type-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.cycleChartType(btn.dataset.slot); })
    );
    document.querySelectorAll('.chart-rt-type-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.cycleRealtimeChartType(btn.dataset.slot); })
    );
    document.querySelectorAll('.chart-download-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.downloadChartData(btn.dataset.slot); })
    );

    // ── Global chart type buttons ──────────────────────────────────────
    const globalTypeBtn   = document.getElementById('globalTypeBtn');
    const globalRtTypeBtn = document.getElementById('globalRtTypeBtn');
    if (globalTypeBtn)   globalTypeBtn.addEventListener('click', () => ChartManager.cycleAllChartTypes());
    if (globalRtTypeBtn) globalRtTypeBtn.addEventListener('click', () => ChartManager.cycleAllRealtimeChartTypes());

    // Show/hide global RT button based on time range
    function _updateGlobalRtButton() {
        const range = ChartManager.getTimeRange();
        if (globalRtTypeBtn) globalRtTypeBtn.style.display = (range === 5) ? '' : 'none';
    }

    // ── Time range buttons ─────────────────────────────────────────────
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = btn.dataset.range;
            if (r === 'custom') { UIManager.openCustomRange(); return; }
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ChartManager.setTimeRange(r === 'all' ? 'all' : parseInt(r));
            _updateGlobalRtButton();
        });
    });

    // ── Mode switch ────────────────────────────────────────────────────
    document.getElementById('modeSwitch').addEventListener('change', e => {
        const stacked = e.target.checked;
        ChartManager.setStackedMode(stacked);
        UIManager.updateModeLabels(stacked);
    });

    // ── Theme ──────────────────────────────────────────────────────────
    document.getElementById('themeToggle').addEventListener('click', () => UIManager.toggleTheme());

    // ── Settings modal ─────────────────────────────────────────────────
    document.addEventListener('click', e => {
        if (e.target.closest('#settingsBtn')) { e.preventDefault(); e.stopPropagation(); UIManager.openSettings(); }
    });
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) closeSettings.addEventListener('click', () => UIManager.closeSettings());
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) settingsModal.addEventListener('click', e => { if (e.target.id === 'settingsModal') UIManager.closeSettings(); });

    // ── Language ───────────────────────────────────────────────────────
    const langSel = document.getElementById('languageSelect');
    if (langSel) {
        langSel.value = localStorage.getItem('munra_language') || 'es';
        langSel.addEventListener('change', e => {
            localStorage.setItem('munra_language', e.target.value);
            if (typeof setLanguage === 'function') setLanguage(e.target.value);
            UIManager.showToast(e.target.value === 'es' ? 'Idioma cambiado a Español' : 'Language changed to English', 'success');
        });
    }

    // ── Database choice ────────────────────────────────────────────────
    const dbChoice = document.getElementById('databaseChoice');
    if (dbChoice) dbChoice.addEventListener('change', e => {
        const custom = document.getElementById('userCustomUrl');
        if (custom) custom.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    // ── Firebase apply buttons ─────────────────────────────────────────
    const applyAdmin = document.getElementById('applyFirebaseBtn');
    if (applyAdmin) applyAdmin.addEventListener('click', () => UIManager.applyFirebaseUrl(true));
    const applyUser = document.getElementById('applyFirebaseBtnUser');
    if (applyUser) applyUser.addEventListener('click', () => UIManager.applyFirebaseUrl(false));
    const migrateBtn = document.getElementById('migrateDbBtn');
    if (migrateBtn) migrateBtn.addEventListener('click', () => UIManager.showMigrateModal());

    // ── Profile select (hidden compat) ─────────────────────────────────
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) profileSelect.addEventListener('change', e => ProfileManager.selectProfile(e.target.value));

    // ── Add / Manage profiles ──────────────────────────────────────────
    document.getElementById('addProfileBtn').addEventListener('click', () => ProfileManager.showCreateModal());
    document.getElementById('manageProfilesBtn').addEventListener('click', () => ProfileManager.showManageModal());

    // ── Detector setup modal ───────────────────────────────────────────
    const detectorModal = document.getElementById('detectorSetupModal');
    const serialBtn     = document.getElementById('serialTerminalBtn');
    const closeDetector = document.getElementById('closeDetectorSetup');

    function openDetectorSetup() {
        // Populate profile list in setup modal (only writable profiles)
        const sel = document.getElementById('setupProfileSelect');
        if (sel && typeof ProfileManager !== 'undefined') {
            const allProfiles = ProfileManager.getAllProfiles ? ProfileManager.getAllProfiles() : {};
            sel.innerHTML = '<option value="">Select profile…</option>';
            Object.entries(allProfiles).forEach(([id, p]) => {
                // Only show profiles the user can WRITE to
                const canWrite = typeof canEditProfile === 'function' ? canEditProfile(p, id) : true;
                if (!canWrite) return;
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = p.name || id;
                sel.appendChild(opt);
            });
            // Pre-select whatever is currently selected in the hidden profileSelect
            const hiddenSel = document.getElementById('profileSelect');
            if (hiddenSel && hiddenSel.value) sel.value = hiddenSel.value;
        }

        // ── Connection mode info ──────────────────────────────────────
        const warnEl = document.getElementById('serialCompatWarning');
        if (warnEl) {
            const hasSerial = ('serial' in navigator);
            if (!hasSerial) {
                // Show WebSocket Bridge info — NOT an error, NOT disabled!
                document.getElementById('serialCompatMsg').textContent = 'WebSocket Bridge Mode';
                document.getElementById('serialCompatDetail').innerHTML =
                    'Your browser will connect via the bridge script (works with <strong>all browsers</strong>).<br>' +
                    '<div style="margin:6px 0;">' +
                    '<strong style="color:#58a6ff;">Step 1:</strong> Install (one time): <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:3px;color:#e6edf3;">pip3 install pyserial websockets</code><br>' +
                    '<strong style="color:#58a6ff;">Step 2:</strong> Run the bridge: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:3px;color:#e6edf3;">python3 tools/serial_bridge.py</code><br>' +
                    '<strong style="color:#58a6ff;">Step 3:</strong> Click Connect in MuNRa</div>' +
                    '<a href="tools/serial_bridge.py" download style="color:#3fb950;">Download serial_bridge.py</a>' +
                    ' <span style="color:#8b949e;">| The bridge also saves data locally (no minicom needed)</span>';
                warnEl.style.display = 'block';
                // Buttons stay ENABLED — bridge mode works!
            } else {
                warnEl.style.display = 'none';
            }
            // Always ensure buttons are enabled
            const tabBtn   = document.getElementById('setupOpenTab');
            const chartBtn = document.getElementById('setupOpenInChart');
            if (tabBtn)   { tabBtn.disabled = false; tabBtn.title = ''; }
            if (chartBtn) { chartBtn.disabled = false; chartBtn.title = ''; }
        }

        detectorModal.classList.add('active');
    }
    function closeDetectorSetup() { detectorModal.classList.remove('active'); }

    if (serialBtn) serialBtn.addEventListener('click', openDetectorSetup);
    if (closeDetector) closeDetector.addEventListener('click', closeDetectorSetup);
    if (detectorModal) detectorModal.addEventListener('click', e => { if (e.target === detectorModal) closeDetectorSetup(); });

    // "Open in New Tab" button
    const setupOpenTab = document.getElementById('setupOpenTab');
    if (setupOpenTab) setupOpenTab.addEventListener('click', () => {
        const profileId = document.getElementById('setupProfileSelect')?.value;
        const realtime  = document.getElementById('setupRealtime')?.checked;
        if (!profileId) { UIManager.showToast('Please select a profile first', 'error'); return; }
        closeDetectorSetup();
        // Open terminal.html in new tab with query params
        const params = new URLSearchParams({ profile: profileId, realtime: realtime ? '1' : '0' });
        window.open(`terminal.html?${params}`, '_blank');
    });

    // "Open in Chart Slot" button
    const setupOpenInChart = document.getElementById('setupOpenInChart');
    if (setupOpenInChart) setupOpenInChart.addEventListener('click', () => {
        const profileId = document.getElementById('setupProfileSelect')?.value;
        if (!profileId) { UIManager.showToast('Please select a profile first', 'error'); return; }
        closeDetectorSetup();

        // Find a slot that isn't already terminal, or use the last slot
        let slot = -1;
        for (let s = 3; s >= 0; s--) {
            const sel = document.querySelector(`.chart-source-select[data-slot="${s}"]`);
            if (sel && sel.value !== 'terminal') { slot = s; break; }
        }
        if (slot < 0) slot = 3;

        // Switch slot to terminal
        const sel = document.querySelector(`.chart-source-select[data-slot="${slot}"]`);
        if (sel) sel.value = 'terminal';
        ChartManager.setSlotSource(slot, 'terminal');

        // Start serial connection (pass the selected profile)
        if (typeof connectSerialPort === 'function') {
            connectSerialPort(profileId);
        } else {
            UIManager.showToast('Serial port API not available in this browser', 'error');
        }
    });

    // ── Upload / Export ────────────────────────────────────────────────
    document.getElementById('uploadSessionBtn').addEventListener('click', () => document.getElementById('sessionFileInput').click());
    document.getElementById('sessionFileInput').addEventListener('change', e => UploadManager.handleSessionFile(e));
    document.getElementById('uploadProfileBtn').addEventListener('click', () => document.getElementById('profileFileInput').click());
    document.getElementById('profileFileInput').addEventListener('change', e => UploadManager.handleProfileFile(e));
    document.getElementById('exportDataBtn').addEventListener('click', () => UploadManager.exportAll());

    // ── Custom range modal ─────────────────────────────────────────────
    const closeCustom = document.getElementById('closeCustomRange');
    if (closeCustom) closeCustom.addEventListener('click', () => document.getElementById('customRangeModal').classList.remove('active'));
    const applyCustom = document.getElementById('applyCustomRange');
    if (applyCustom) applyCustom.addEventListener('click', () => UIManager.applyCustomRange());
    const customModal = document.getElementById('customRangeModal');
    if (customModal) customModal.addEventListener('click', e => { if (e.target.id === 'customRangeModal') customModal.classList.remove('active'); });

    // ── Esc key — close topmost overlay ─────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        // Close in priority order (topmost first)
        const adminModal = document.getElementById('adminModal');
        if (adminModal && adminModal.classList.contains('active')) { adminModal.classList.remove('active'); return; }
        const authModal = document.getElementById('authModal');
        if (authModal && authModal.classList.contains('active')) { authModal.classList.remove('active'); return; }
        const settingsM = document.getElementById('settingsModal');
        if (settingsM && settingsM.classList.contains('active')) { UIManager.closeSettings(); return; }
        const customM = document.getElementById('customRangeModal');
        if (customM && customM.classList.contains('active')) { customM.classList.remove('active'); return; }
        const detectorM = document.getElementById('detectorSetupModal');
        if (detectorM && detectorM.classList.contains('active')) { detectorM.classList.remove('active'); return; }
        if (profilePanel && profilePanel.classList.contains('open')) { closeProfilePanel(); return; }
        // Close user dropdown if open
        const userDd = document.getElementById('userDropdown');
        if (userDd && userDd.classList.contains('show')) { userDd.classList.remove('show'); return; }
    });

    // ── Mobile time-range dropdown ──────────────────────────────────────
    const timeRangeMobile = document.getElementById('timeRangeMobile');
    if (timeRangeMobile) {
        timeRangeMobile.addEventListener('change', () => {
            const r = timeRangeMobile.value;
            if (r === 'custom') { UIManager.openCustomRange(); return; }
            // Sync desktop buttons
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            const matchBtn = document.querySelector(`.time-btn[data-range="${r}"]`);
            if (matchBtn) matchBtn.classList.add('active');
            ChartManager.setTimeRange(r === 'all' ? 'all' : parseInt(r));
            _updateGlobalRtButton();
        });
    }

    // ── 5. Initial state ─────────────────────────────────────────────
    // Realtime cleanup is handled by serial-reader.js on a per-session basis.
    // No global cleanup runs here — it only runs when recording with realtime enabled.
    _updateRealtimeButtonStates();
    _updateGlobalRtButton();

    // Periodic RT expiry check every 30 seconds
    setInterval(() => _updateRealtimeButtonStates(), 30_000);

    console.log('MuNRa 4.8.1 — modular init complete');
});
