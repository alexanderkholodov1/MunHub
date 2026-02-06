/**
 * MuNRa 4.2 — Entry Point / Orchestrator
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
    DataManager.onChange(() => ChartManager.scheduleUpdate());

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
    document.querySelectorAll('.chart-download-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.downloadChartData(btn.dataset.slot); })
    );

    // ── Time range buttons ─────────────────────────────────────────────
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = btn.dataset.range;
            if (r === 'custom') { UIManager.openCustomRange(); return; }
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ChartManager.setTimeRange(r === 'all' ? 'all' : parseInt(r));
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
        // Populate profile list in setup modal
        const sel = document.getElementById('setupProfileSelect');
        if (sel && typeof ProfileManager !== 'undefined') {
            const allProfiles = ProfileManager.getAllProfiles ? ProfileManager.getAllProfiles() : {};
            sel.innerHTML = '<option value="">Select profile…</option>';
            Object.entries(allProfiles).forEach(([id, p]) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = p.name || id;
                sel.appendChild(opt);
            });
            // Pre-select whatever is currently selected in the hidden profileSelect
            const hiddenSel = document.getElementById('profileSelect');
            if (hiddenSel && hiddenSel.value) sel.value = hiddenSel.value;
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

    // ── 5. Periodic tasks ──────────────────────────────────────────────
    setInterval(() => DataManager.cleanupAllRealtime(), PERF.CLEANUP_INTERVAL_MS);

    console.log('MuNRa 4.2 — modular init complete');
});
