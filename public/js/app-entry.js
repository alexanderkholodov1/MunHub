/**
 * MunHub 5.0 — Entry Point / Orchestrator
 *
 * Wires IIFE modules + DOM listeners.  NO business logic here.
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
        const r = ChartManager.getTimeRange();
        if (r === 1 || r === 5) ChartManager.scheduleUpdate();
        _updateRealtimeButtonStates();
    });

    /** Disable 1m/5m buttons when no realtime data or data is stale */
    function _updateRealtimeButtonStates() {
        const hasRT = DataManager.hasRealtimeData();
        const expired = DataManager.isRealtimeExpired ? DataManager.isRealtimeExpired() : false;
        const available = hasRT && !expired;
        document.querySelectorAll('.time-btn').forEach(btn => {
            const r = btn.dataset.range;
            if (r === '1' || r === '5') {
                btn.classList.toggle('rt-disabled', !available);
                btn.title = available ? '' : (expired ? 'Real-time data is stale. Reconnect detector.' : 'Enable real-time data when connecting a detector');
            }
        });
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
            const defaults = ['events', 'sipm', 'temp', 'deadtime'];
            if (saved !== defaults[s]) ChartManager.setSlotSource(s, saved);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════

    // ── About modal ────────────────────────────────────────────────────
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutModal = document.getElementById('aboutModal');
    const closeAbout = document.getElementById('closeAbout');
    if (aboutBtn) aboutBtn.addEventListener('click', () => aboutModal?.classList.add('active'));
    if (closeAbout) closeAbout.addEventListener('click', () => aboutModal?.classList.remove('active'));
    if (aboutModal) aboutModal.addEventListener('click', e => { if (e.target === aboutModal) aboutModal.classList.remove('active'); });

    // ── Profile overlay panel ──────────────────────────────────────────
    const profilePanel    = document.getElementById('profilePanel');
    const profileBackdrop = document.getElementById('profileBackdrop');
    const profilesBtn     = document.getElementById('profilesBtn');
    const profilePanelClose = document.getElementById('profilePanelClose');

    function openProfilePanel() { profilePanel?.classList.add('open'); profileBackdrop?.classList.add('open'); }
    function closeProfilePanel() { profilePanel?.classList.remove('open'); profileBackdrop?.classList.remove('open'); }
    if (profilesBtn) profilesBtn.addEventListener('click', openProfilePanel);
    if (profilePanelClose) profilePanelClose.addEventListener('click', closeProfilePanel);
    if (profileBackdrop) profileBackdrop.addEventListener('click', closeProfilePanel);

    // ── Tree section collapse/expand ───────────────────────────────────
    document.querySelectorAll('.tree-section-head').forEach(head => {
        head.addEventListener('click', () => head.closest('.tree-section').classList.toggle('open'));
    });

    // ── Profile search ─────────────────────────────────────────────────
    const profileSearch = document.getElementById('profileSearch');
    if (profileSearch) profileSearch.addEventListener('input', e => ProfileManager.filterProfiles(e.target.value));

    // ── Chart source selectors ─────────────────────────────────────────
    document.querySelectorAll('.chart-source-select').forEach(sel => {
        sel.addEventListener('change', () => ChartManager.setSlotSource(parseInt(sel.dataset.slot), sel.value));
    });

    // ── Chart type cycling, download, info, color ──────────────────────
    document.querySelectorAll('.chart-type-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.cycleChartType(btn.dataset.slot); })
    );
    document.querySelectorAll('.chart-rt-type-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.cycleRealtimeChartType(btn.dataset.slot); })
    );
    document.querySelectorAll('.chart-download-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.downloadChartData(btn.dataset.slot); })
    );
    document.querySelectorAll('.chart-info-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChartManager.showChartInfo(btn.dataset.slot); })
    );
    document.querySelectorAll('.chart-color-btn').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); _showSlotColorPopup(parseInt(btn.dataset.slot)); })
    );

    // ── Global chart type & color buttons ──────────────────────────────
    const globalTypeBtn   = document.getElementById('globalTypeBtn');
    const globalRtTypeBtn = document.getElementById('globalRtTypeBtn');
    const globalColorBtn  = document.getElementById('globalColorBtn');
    if (globalTypeBtn)   globalTypeBtn.addEventListener('click', () => ChartManager.cycleAllChartTypes());
    if (globalRtTypeBtn) globalRtTypeBtn.addEventListener('click', () => ChartManager.cycleAllRealtimeChartTypes());
    if (globalColorBtn)  globalColorBtn.addEventListener('click', () => _openGlobalColorModal());

    function _updateGlobalRtButton() {
        const r = ChartManager.getTimeRange();
        if (globalRtTypeBtn) globalRtTypeBtn.style.display = (r === 5) ? '' : 'none';
    }

    // ── Per-slot color popup ───────────────────────────────────────────
    function _showSlotColorPopup(slot) {
        const panel = document.getElementById(`chartPanel${slot}`);
        if (!panel) return;
        // Remove existing popup
        const existing = panel.querySelector('.chart-info-popup');
        if (existing) { existing.remove(); return; }

        const colors = ChartManager.getSlotColors(slot);
        if (!colors.length) return;

        const popup = document.createElement('div');
        popup.className = 'chart-info-popup';
        popup.style.maxWidth = '300px';
        let html = '<button class="close-info">&times;</button><h4>Colors</h4>';
        colors.forEach((c, i) => {
            html += `<div class="color-picker-row">
                <label>${c.label}</label>
                <input type="color" value="${c.color}" data-slot="${slot}" data-ds="${i}">
            </div>`;
        });
        html += `<div style="margin-top:8px"><button class="color-random-btn" data-slot="${slot}">🎲 Randomize All</button></div>`;
        popup.innerHTML = html;

        popup.querySelector('.close-info').addEventListener('click', () => popup.remove());
        popup.querySelectorAll('input[type="color"]').forEach(inp => {
            inp.addEventListener('input', e => {
                ChartManager.setDatasetColor(parseInt(e.target.dataset.slot), parseInt(e.target.dataset.ds), e.target.value);
            });
        });
        popup.querySelector('.color-random-btn').addEventListener('click', e => {
            ChartManager.randomizeSlotColors(parseInt(e.target.dataset.slot));
            // Update the color inputs
            const newColors = ChartManager.getSlotColors(slot);
            popup.querySelectorAll('input[type="color"]').forEach((inp, i) => { if (newColors[i]) inp.value = newColors[i].color; });
        });

        panel.style.position = 'relative';
        panel.appendChild(popup);
    }

    // ── Global Color & Style Modal ─────────────────────────────────────
    function _openGlobalColorModal() {
        const modal = document.getElementById('globalColorModal');
        const body  = document.getElementById('globalColorBody');
        if (!modal || !body) return;

        const allLabels = ChartManager.getAllDatasetLabels();
        const customs   = ChartManager.getCustomizations();

        let html = '<div class="settings-section" style="margin-bottom:14px"><h3 style="margin-bottom:10px">Style Settings</h3>';
        html += `<div class="chart-customize-row">
            <label>Dot Size</label>
            <input type="range" min="1" max="8" step="0.5" value="${customs.dotSize}" id="customDotSize">
            <span class="range-value" id="valDotSize">${customs.dotSize}</span>
        </div>`;
        html += `<div class="chart-customize-row">
            <label>Smooth Tension</label>
            <input type="range" min="0" max="1" step="0.05" value="${customs.tension}" id="customTension">
            <span class="range-value" id="valTension">${customs.tension}</span>
        </div>`;
        html += '</div>';

        html += '<div class="settings-section"><h3 style="margin-bottom:10px">Dataset Colors</h3>';
        allLabels.forEach(item => {
            html += `<div class="color-picker-row">
                <label>${item.label} <span style="font-size:0.72rem;color:var(--text-secondary)">(slot ${item.slot + 1})</span></label>
                <input type="color" value="${item.color}" data-slot="${item.slot}" data-ds="${item.index}">
            </div>`;
        });
        html += `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-teal" id="randomizeAllColors">🎲 Randomize All</button>
        </div>`;
        html += '</div>';
        body.innerHTML = html;

        // Slider handlers
        const dotSlider = document.getElementById('customDotSize');
        const tenSlider = document.getElementById('customTension');
        if (dotSlider) dotSlider.addEventListener('input', e => {
            document.getElementById('valDotSize').textContent = e.target.value;
            ChartManager.setCustomization('dotSize', parseFloat(e.target.value));
        });
        if (tenSlider) tenSlider.addEventListener('input', e => {
            document.getElementById('valTension').textContent = e.target.value;
            ChartManager.setCustomization('tension', parseFloat(e.target.value));
        });

        // Color handlers
        body.querySelectorAll('input[type="color"]').forEach(inp => {
            inp.addEventListener('input', e => {
                ChartManager.setDatasetColor(parseInt(e.target.dataset.slot), parseInt(e.target.dataset.ds), e.target.value);
            });
        });

        // Randomize all
        const randBtn = document.getElementById('randomizeAllColors');
        if (randBtn) randBtn.addEventListener('click', () => {
            for (let s = 0; s < 4; s++) ChartManager.randomizeSlotColors(s);
            // Refresh modal
            _openGlobalColorModal();
        });

        modal.classList.add('active');
    }
    const closeGlobalColor = document.getElementById('closeGlobalColor');
    if (closeGlobalColor) closeGlobalColor.addEventListener('click', () => document.getElementById('globalColorModal')?.classList.remove('active'));
    const gcModal = document.getElementById('globalColorModal');
    if (gcModal) gcModal.addEventListener('click', e => { if (e.target === gcModal) gcModal.classList.remove('active'); });

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

    // ── Database choice (user-level) ───────────────────────────────────
    const dbChoice = document.getElementById('databaseChoice');
    if (dbChoice) dbChoice.addEventListener('change', e => {
        const custom = document.getElementById('userCustomUrl');
        if (custom) custom.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    const applyUser = document.getElementById('applyFirebaseBtnUser');
    if (applyUser) applyUser.addEventListener('click', () => UIManager.applyFirebaseUrl(false));

    // ── Profile select (hidden compat) ─────────────────────────────────
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) profileSelect.addEventListener('change', e => ProfileManager.selectProfile(e.target.value));

    // ── Add / Manage profiles ──────────────────────────────────────────
    document.getElementById('addProfileBtn')?.addEventListener('click', () => ProfileManager.showCreateModal());
    document.getElementById('manageProfilesBtn')?.addEventListener('click', () => ProfileManager.showManageModal());

    // ── Detector setup modal ───────────────────────────────────────────
    const detectorModal = document.getElementById('detectorSetupModal');
    const serialBtn     = document.getElementById('serialTerminalBtn');
    const closeDetector = document.getElementById('closeDetectorSetup');

    function openDetectorSetup() {
        const sel = document.getElementById('setupProfileSelect');
        if (sel && typeof ProfileManager !== 'undefined') {
            const allProfiles = ProfileManager.getAllProfiles ? ProfileManager.getAllProfiles() : {};
            sel.innerHTML = '<option value="">Select profile…</option>';
            Object.entries(allProfiles).forEach(([id, p]) => {
                const canWrite = typeof canEditProfile === 'function' ? canEditProfile(p, id) : true;
                if (!canWrite) return;
                const opt = document.createElement('option');
                opt.value = id; opt.textContent = p.name || id;
                sel.appendChild(opt);
            });
            const hiddenSel = document.getElementById('profileSelect');
            if (hiddenSel && hiddenSel.value) sel.value = hiddenSel.value;
        }

        const warnEl = document.getElementById('serialCompatWarning');
        if (warnEl) {
            if (!('serial' in navigator)) {
                document.getElementById('serialCompatMsg').textContent = 'WebSocket Bridge Mode';
                document.getElementById('serialCompatDetail').innerHTML =
                    'Your browser will connect via the bridge script (works with <strong>all browsers</strong>).<br>' +
                    '<div style="margin:6px 0;">' +
                    '<strong style="color:var(--info)">Step 1:</strong> Install: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:3px">pip3 install pyserial websockets</code><br>' +
                    '<strong style="color:var(--info)">Step 2:</strong> Run: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:3px">python3 tools/serial_bridge.py</code><br>' +
                    '<strong style="color:var(--info)">Step 3:</strong> Click Connect</div>' +
                    `<a href="tools/serial_bridge.py" download style="color:var(--success)">Download serial_bridge.py</a>`;
                warnEl.style.display = 'block';
            } else { warnEl.style.display = 'none'; }
        }
        detectorModal?.classList.add('active');
    }
    function closeDetectorSetup() { detectorModal?.classList.remove('active'); }

    if (serialBtn) serialBtn.addEventListener('click', openDetectorSetup);
    if (closeDetector) closeDetector.addEventListener('click', closeDetectorSetup);
    if (detectorModal) detectorModal.addEventListener('click', e => { if (e.target === detectorModal) closeDetectorSetup(); });

    // "Open in New Tab"
    document.getElementById('setupOpenTab')?.addEventListener('click', () => {
        const profileId = document.getElementById('setupProfileSelect')?.value;
        const realtime  = document.getElementById('setupRealtime')?.checked;
        if (!profileId) { UIManager.showToast('Select a profile first', 'error'); return; }
        closeDetectorSetup();
        const params = new URLSearchParams({ profile: profileId, realtime: realtime ? '1' : '0' });
        window.open(`terminal.html?${params}`, '_blank');
    });

    // "Open in Chart Slot"
    document.getElementById('setupOpenInChart')?.addEventListener('click', () => {
        const profileId = document.getElementById('setupProfileSelect')?.value;
        if (!profileId) { UIManager.showToast('Select a profile first', 'error'); return; }
        closeDetectorSetup();
        let slot = -1;
        for (let s = 3; s >= 0; s--) {
            const sel = document.querySelector(`.chart-source-select[data-slot="${s}"]`);
            if (sel && sel.value !== 'terminal') { slot = s; break; }
        }
        if (slot < 0) slot = 3;
        const sel = document.querySelector(`.chart-source-select[data-slot="${slot}"]`);
        if (sel) sel.value = 'terminal';
        ChartManager.setSlotSource(slot, 'terminal');
        if (typeof connectSerialPort === 'function') connectSerialPort(profileId);
        else UIManager.showToast('Serial port API not available', 'error');
    });

    // ── Upload / Export ────────────────────────────────────────────────
    document.getElementById('uploadSessionBtn')?.addEventListener('click', () => document.getElementById('sessionFileInput')?.click());
    document.getElementById('sessionFileInput')?.addEventListener('change', e => UploadManager.handleSessionFile(e));
    document.getElementById('uploadProfileBtn')?.addEventListener('click', () => document.getElementById('profileFileInput')?.click());
    document.getElementById('profileFileInput')?.addEventListener('change', e => UploadManager.handleProfileFile(e));
    document.getElementById('exportDataBtn')?.addEventListener('click', () => UploadManager.exportAll());

    // ── Custom range modal ─────────────────────────────────────────────
    document.getElementById('closeCustomRange')?.addEventListener('click', () => document.getElementById('customRangeModal')?.classList.remove('active'));
    document.getElementById('applyCustomRange')?.addEventListener('click', () => UIManager.applyCustomRange());
    const customModal = document.getElementById('customRangeModal');
    if (customModal) customModal.addEventListener('click', e => { if (e.target === customModal) customModal.classList.remove('active'); });

    // ── Esc key — close topmost overlay ─────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const modals = ['globalColorModal', 'adminModal', 'aboutModal', 'authModal', 'settingsModal', 'customRangeModal', 'detectorSetupModal'];
        for (const id of modals) {
            const m = document.getElementById(id);
            if (m && m.classList.contains('active')) { m.classList.remove('active'); return; }
        }
        if (profilePanel && profilePanel.classList.contains('open')) { closeProfilePanel(); return; }
        const userDd = document.getElementById('userDropdown');
        if (userDd && userDd.classList.contains('show')) { userDd.classList.remove('show'); return; }
    });

    // ── Mobile time-range dropdown ──────────────────────────────────────
    const timeRangeMobile = document.getElementById('timeRangeMobile');
    if (timeRangeMobile) {
        timeRangeMobile.addEventListener('change', () => {
            const r = timeRangeMobile.value;
            if (r === 'custom') { UIManager.openCustomRange(); return; }
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            const matchBtn = document.querySelector(`.time-btn[data-range="${r}"]`);
            if (matchBtn) matchBtn.classList.add('active');
            ChartManager.setTimeRange(r === 'all' ? 'all' : parseInt(r));
            _updateGlobalRtButton();
        });
    }

    // ── 5. Initial state ─────────────────────────────────────────────
    _updateRealtimeButtonStates();
    _updateGlobalRtButton();
    setInterval(() => _updateRealtimeButtonStates(), 30_000);

    console.log(`MunHub ${APP_VERSION} — init complete`);
});
