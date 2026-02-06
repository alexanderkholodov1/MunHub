/**
 * MuNRa 4.1 — Entry Point / Orchestrator
 * 
 * This file is intentionally small. It wires together the IIFE modules
 * and sets up DOM event listeners.  NO business logic belongs here.
 * 
 * Load order (in index.html):
 *   config → ui-manager → firebase-manager → data-manager →
 *   chart-manager → profile-manager → upload-manager →
 *   auth → serial-reader → app  (this file)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── 0. Global bridges ──────────────────────────────────────────────
    // auth.js and serial-reader.js call showToast() globally
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

    // Apply saved preferences AFTER init
    ChartManager.setStackedMode(savedStacked);
    const range = savedRange === 'all' || savedRange === 'custom'
        ? savedRange : parseInt(savedRange) || 15;
    ChartManager.setTimeRange(range);
    UIManager.highlightTimeButton(range);

    // ── 3. Data → Chart pipeline ───────────────────────────────────────
    DataManager.onChange(() => ChartManager.scheduleUpdate());

    // ── 4. Event Listeners ─────────────────────────────────────────────

    // ── Sidebar toggle ─────────────────────────────────────────────────
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    // Restore sidebar state
    if (localStorage.getItem('munra_sidebar') === 'collapsed') {
        sidebar.classList.add('collapsed');
    }
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('munra_sidebar', sidebar.classList.contains('collapsed') ? 'collapsed' : 'open');
        // Trigger chart resize after transition
        setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    });

    // ── Tree section collapse/expand ───────────────────────────────────
    document.querySelectorAll('.tree-section-head').forEach(head => {
        head.addEventListener('click', () => {
            head.closest('.tree-section').classList.toggle('open');
        });
    });

    // ── Profile search ─────────────────────────────────────────────────
    const profileSearch = document.getElementById('profileSearch');
    if (profileSearch) {
        profileSearch.addEventListener('input', e => {
            ProfileManager.filterProfiles(e.target.value);
        });
    }

    // Time range buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = btn.dataset.range;
            if (r === 'custom') { UIManager.openCustomRange(); return; }

            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const range = r === 'all' ? 'all' : parseInt(r);
            ChartManager.setTimeRange(range);
        });
    });

    // Mode switch (ACCURATE / STACKED)
    document.getElementById('modeSwitch').addEventListener('change', e => {
        const stacked = e.target.checked;
        ChartManager.setStackedMode(stacked);
        UIManager.updateModeLabels(stacked);
    });

    // Theme
    document.getElementById('themeToggle').addEventListener('click', () => UIManager.toggleTheme());

    // Settings modal (event delegation for reliability)
    document.addEventListener('click', e => {
        if (e.target.closest('#settingsBtn')) {
            e.preventDefault(); e.stopPropagation();
            UIManager.openSettings();
        }
    });
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) closeSettings.addEventListener('click', () => UIManager.closeSettings());
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) settingsModal.addEventListener('click', e => { if (e.target.id === 'settingsModal') UIManager.closeSettings(); });

    // Language
    const langSel = document.getElementById('languageSelect');
    if (langSel) {
        langSel.value = localStorage.getItem('munra_language') || 'es';
        langSel.addEventListener('change', e => {
            localStorage.setItem('munra_language', e.target.value);
            if (typeof setLanguage === 'function') setLanguage(e.target.value);
            UIManager.showToast(e.target.value === 'es' ? 'Idioma cambiado a Español' : 'Language changed to English', 'success');
        });
    }

    // Database choice (regular users)
    const dbChoice = document.getElementById('databaseChoice');
    if (dbChoice) dbChoice.addEventListener('change', e => {
        const custom = document.getElementById('userCustomUrl');
        if (custom) custom.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    // Firebase apply buttons
    const applyAdmin = document.getElementById('applyFirebaseBtn');
    if (applyAdmin) applyAdmin.addEventListener('click', () => UIManager.applyFirebaseUrl(true));
    const applyUser = document.getElementById('applyFirebaseBtnUser');
    if (applyUser) applyUser.addEventListener('click', () => UIManager.applyFirebaseUrl(false));
    const migrateBtn = document.getElementById('migrateDbBtn');
    if (migrateBtn) migrateBtn.addEventListener('click', () => UIManager.showMigrateModal());

    // Hidden profile select (backwards-compat, not visible in UI)
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) {
        profileSelect.addEventListener('change', e => {
            ProfileManager.selectProfile(e.target.value);
        });
    }

    // Add / Manage profiles (sidebar buttons)
    document.getElementById('addProfileBtn').addEventListener('click', () => ProfileManager.showCreateModal());
    document.getElementById('manageProfilesBtn').addEventListener('click', () => ProfileManager.showManageModal());

    // Serial terminal
    const serialBtn = document.getElementById('serialTerminalBtn');
    if (serialBtn) serialBtn.addEventListener('click', () => {
        if (typeof showSerialTerminal === 'function') showSerialTerminal();
        else UIManager.showToast('Serial terminal not available', 'error');
    });

    // Chart type cycling & download
    document.querySelectorAll('.chart-type-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.cycleChartType(btn.dataset.chart); })
    );
    document.querySelectorAll('.chart-download-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.downloadChartData(btn.dataset.chart); })
    );

    // Upload / Export
    document.getElementById('uploadSessionBtn').addEventListener('click', () => document.getElementById('sessionFileInput').click());
    document.getElementById('sessionFileInput').addEventListener('change', e => UploadManager.handleSessionFile(e));
    document.getElementById('uploadProfileBtn').addEventListener('click', () => document.getElementById('profileFileInput').click());
    document.getElementById('profileFileInput').addEventListener('change', e => UploadManager.handleProfileFile(e));
    document.getElementById('exportDataBtn').addEventListener('click', () => UploadManager.exportAll());

    // Custom range modal
    const closeCustom = document.getElementById('closeCustomRange');
    if (closeCustom) closeCustom.addEventListener('click', () => document.getElementById('customRangeModal').classList.remove('active'));
    const applyCustom = document.getElementById('applyCustomRange');
    if (applyCustom) applyCustom.addEventListener('click', () => UIManager.applyCustomRange());
    const customModal = document.getElementById('customRangeModal');
    if (customModal) customModal.addEventListener('click', e => { if (e.target.id === 'customRangeModal') customModal.classList.remove('active'); });

    // ── 5. Periodic tasks ──────────────────────────────────────────────
    setInterval(() => DataManager.cleanupAllRealtime(), PERF.CLEANUP_INTERVAL_MS);

    console.log('MuNRa 4.1 — modular init complete');
});
