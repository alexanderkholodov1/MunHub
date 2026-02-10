/**
 * MunHub 5.0 — Database Administration Module
 *
 * Provides the "Database" tab in Admin Panel with:
 *   - Current DB URL display
 *   - Detailed storage statistics (per-node size breakdown)
 *   - Profile/session/minute/realtime counts
 *   - Firebase free-tier quota visualization
 *   - Database Duplication (copy all data to a new DB)
 *   - Root DB URL change (switch the entire app to a new DB)
 *
 * Depends on: config.js, firebase-manager.js, ui-manager.js
 */

const DbAdmin = (() => {
    // Firebase free-tier limits
    const FREE_TIER = Object.freeze({
        STORAGE_MB:      1024,       // 1 GB storage
        DOWNLOAD_GB:     10,         // 10 GB/month downloads
        DOWNLOAD_DAY_MB: 360,        // 360 MB/day
        CONNECTIONS:     100         // 100 simultaneous connections
    });

    let _statsCache = null;

    // ─── Auth Token Helper (fixes 401 on secured DBs) ───────────────────
    async function _getAuthToken() {
        try {
            const user = firebase.auth().currentUser;
            if (user) return await user.getIdToken();
        } catch (e) { /* no user */ }
        return null;
    }
    function _authQuery(baseUrl, extraParams = '') {
        // Returns URL with auth param if available (sync fallback)
        return baseUrl + extraParams;
    }
    async function _fetchWithAuth(url) {
        const token = await _getAuthToken();
        const sep = url.includes('?') ? '&' : '?';
        const finalUrl = token ? `${url}${sep}auth=${token}` : url;
        return fetch(finalUrl);
    }

    // ─── Get Active DB URL ──────────────────────────────────────────────
    /** Returns the currently active database URL (respects user override). */
    function getActiveDbUrl() {
        return localStorage.getItem('munra_firebase_url') || DEFAULT_FIREBASE_URL;
    }

    // ─── Render the Database Panel ──────────────────────────────────────
    async function renderPanel() {
        const container = document.getElementById('dbAdminContent');
        if (!container) return;

        container.innerHTML = _buildPanelHTML();
        _attachEventListeners();

        // Auto-load statistics
        await loadStats();
    }

    function _buildPanelHTML() {
        const dbUrl = getActiveDbUrl();
        const isCustom = dbUrl !== DEFAULT_FIREBASE_URL;

        return `
        <!-- Current Connection -->
        <div style="margin-bottom:20px">
            <h3 style="color:var(--text-primary);margin:0 0 12px;font-size:15px">Current Database</h3>
            <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;padding:14px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="width:8px;height:8px;border-radius:50%;background:#2ea043;flex-shrink:0"></span>
                    <span style="color:var(--text-primary);font-weight:500;font-size:13px">Connected</span>
                    ${isCustom ? '<span style="background:#e5a00d;color:#000;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600">CUSTOM</span>' : ''}
                </div>
                <code style="display:block;background:var(--bg-secondary);padding:10px;border-radius:6px;font-size:12px;color:var(--accent-primary);word-break:break-all;user-select:all">${dbUrl}</code>
                ${isCustom ? `<p style="color:var(--text-secondary);font-size:11px;margin:8px 0 0">Default: <code style="font-size:11px">${DEFAULT_FIREBASE_URL}</code></p>` : ''}
            </div>
        </div>

        <!-- Storage Statistics -->
        <div style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 style="color:var(--text-primary);margin:0;font-size:15px">Storage &amp; Usage</h3>
                <button id="dbRefreshStats" style="padding:4px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-tertiary);color:var(--text-secondary);cursor:pointer;font-size:12px">Refresh</button>
            </div>
            <div id="dbStatsContainer">
                <div style="text-align:center;padding:30px;color:var(--text-secondary)">
                    <div class="loading-spinner" style="width:24px;height:24px;border:2px solid var(--border-color);border-top-color:var(--accent-primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 10px"></div>
                    Analyzing database...
                </div>
            </div>
        </div>

        <!-- Danger Zone -->
        <div style="margin-bottom:10px">
            <h3 style="color:#f85149;margin:0 0 12px;font-size:15px">Danger Zone</h3>

            <!-- Duplicate Database -->
            <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;padding:14px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <div>
                        <div style="color:var(--text-primary);font-weight:500;font-size:14px">Duplicate Database</div>
                        <div style="color:var(--text-secondary);font-size:12px;margin-top:2px">Copy ALL data from current DB to a new Firebase Realtime Database</div>
                    </div>
                    <button id="dbDuplicateBtn" style="padding:6px 16px;border:none;border-radius:6px;background:#e5a00d;color:#000;cursor:pointer;font-weight:600;font-size:12px;white-space:nowrap">Duplicate...</button>
                </div>
            </div>

            <!-- Change Root Database -->
            <div style="background:var(--bg-tertiary);border:2px solid #f85149;border-radius:8px;padding:14px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <div>
                        <div style="color:#f85149;font-weight:600;font-size:14px">Change Root Database URL</div>
                        <div style="color:var(--text-secondary);font-size:12px;margin-top:2px">Switch the ENTIRE application to a different database. Affects all users and all terminals.</div>
                    </div>
                    <button id="dbChangeRootBtn" style="padding:6px 16px;border:none;border-radius:6px;background:#f85149;color:white;cursor:pointer;font-weight:600;font-size:12px;white-space:nowrap">Change Root DB...</button>
                </div>
            </div>
        </div>

        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
    }

    // ─── Load & Display Statistics ──────────────────────────────────────
    async function loadStats() {
        const container = document.getElementById('dbStatsContainer');
        if (!container) return;

        try {
            const db = FirebaseManager.getDb();
            if (!db) throw new Error('Not connected');

            const dbUrl = getActiveDbUrl();

            // Step 1: Get top-level keys with shallow query
            const shallowRes = await _fetchWithAuth(`${dbUrl}/.json?shallow=true`);
            if (!shallowRes.ok) throw new Error(`HTTP ${shallowRes.status}`);
            const topKeys = await shallowRes.json() || {};

            // Step 2: Measure each top-level node individually (parallel)
            const nodeStats = [];
            let totalBytes = 0;

            const measurements = await Promise.all(
                Object.keys(topKeys).map(async (key) => {
                    try {
                        const res = await _fetchWithAuth(`${dbUrl}/${key}.json`);
                        const text = await res.text();
                        const sizeBytes = new Blob([text]).size;
                        const data = JSON.parse(text);
                        return { key, sizeBytes, data };
                    } catch (e) {
                        return { key, sizeBytes: 0, data: null, error: e.message };
                    }
                })
            );

            // Step 3: Analyze data structure
            let profileCount = 0, sessionCount = 0, minuteCount = 0, realtimeCount = 0, userCount = 0;
            const breakdown = [];

            for (const m of measurements) {
                totalBytes += m.sizeBytes;
                const sizeMB = (m.sizeBytes / 1024 / 1024).toFixed(2);
                const sizeKB = (m.sizeBytes / 1024).toFixed(1);
                const sizeLabel = m.sizeBytes > 1048576 ? `${sizeMB} MB` : `${sizeKB} KB`;

                if (m.key === 'profiles' && m.data) {
                    const profiles = Object.entries(m.data);
                    profileCount = profiles.length;
                    for (const [, p] of profiles) {
                        if (p.sessions) {
                            const sessions = Object.values(p.sessions);
                            sessionCount += sessions.length;
                            for (const s of sessions) {
                                if (s.minutes) minuteCount += Object.keys(s.minutes).length;
                            }
                        }
                        if (p.realtime) realtimeCount += Object.keys(p.realtime).length;
                    }
                } else if (m.key === 'users' && m.data) {
                    userCount = Object.keys(m.data).length;
                }

                breakdown.push({ key: m.key, size: m.sizeBytes, label: sizeLabel, error: m.error });
            }

            breakdown.sort((a, b) => b.size - a.size);
            const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
            const storagePercent = Math.min(100, (totalBytes / (FREE_TIER.STORAGE_MB * 1024 * 1024)) * 100);

            _statsCache = { totalBytes, profileCount, sessionCount, minuteCount, realtimeCount, userCount, breakdown };

            // Render stats
            container.innerHTML = `
            <!-- Overview Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
                ${_statCard('Total Storage', totalMB + ' MB', `of ${FREE_TIER.STORAGE_MB} MB`, storagePercent)}
                ${_statCard('Profiles', profileCount, sessionCount + ' sessions')}
                ${_statCard('Minutes', minuteCount.toLocaleString(), 'data points')}
                ${_statCard('Realtime', realtimeCount.toLocaleString(), 'live entries')}
                ${_statCard('Users', userCount, 'registered')}
            </div>

            <!-- Storage Bar -->
            <div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span style="color:var(--text-secondary);font-size:11px">Storage: ${totalMB} MB / ${FREE_TIER.STORAGE_MB} MB</span>
                    <span style="color:var(--text-secondary);font-size:11px">${storagePercent.toFixed(1)}%</span>
                </div>
                <div style="background:var(--bg-secondary);border-radius:4px;height:8px;overflow:hidden">
                    <div style="background:${storagePercent > 80 ? '#f85149' : storagePercent > 50 ? '#e5a00d' : '#2ea043'};height:100%;width:${storagePercent}%;transition:width 0.5s;border-radius:4px"></div>
                </div>
            </div>

            <!-- Per-Node Breakdown -->
            <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;padding:12px">
                <div style="color:var(--text-secondary);font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:8px">Storage Breakdown</div>
                ${breakdown.map(n => {
                    const pct = totalBytes > 0 ? (n.size / totalBytes * 100).toFixed(1) : 0;
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border-color)">
                        <div style="display:flex;align-items:center;gap:8px">
                            <code style="color:var(--accent-primary);font-size:12px">/${n.key}</code>
                            ${n.error ? '<span style="color:#f85149;font-size:10px">error</span>' : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:12px">
                            <span style="color:var(--text-secondary);font-size:11px">${pct}%</span>
                            <span style="color:var(--text-primary);font-size:12px;font-weight:500;min-width:70px;text-align:right">${n.label}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Free Tier Limits -->
            <div style="margin-top:16px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;padding:12px">
                <div style="color:var(--text-secondary);font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:8px">Firebase Free Tier (Spark Plan)</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
                    <span style="color:var(--text-secondary)">Storage limit:</span>
                    <span style="color:var(--text-primary);text-align:right">${FREE_TIER.STORAGE_MB} MB (1 GB)</span>
                    <span style="color:var(--text-secondary)">Downloads/month:</span>
                    <span style="color:var(--text-primary);text-align:right">${FREE_TIER.DOWNLOAD_GB} GB</span>
                    <span style="color:var(--text-secondary)">Downloads/day:</span>
                    <span style="color:var(--text-primary);text-align:right">${FREE_TIER.DOWNLOAD_DAY_MB} MB</span>
                    <span style="color:var(--text-secondary)">Simultaneous connections:</span>
                    <span style="color:var(--text-primary);text-align:right">${FREE_TIER.CONNECTIONS}</span>
                </div>
                <p style="color:var(--text-secondary);font-size:11px;margin:8px 0 0;font-style:italic">
                    Note: Download and connection metrics are only visible in the Firebase Console. Storage is estimated from data size.
                </p>
            </div>
            `;

        } catch (err) {
            container.innerHTML = `
            <div style="background:#2d1b1b;border:1px solid #f85149;border-radius:8px;padding:16px;text-align:center">
                <div style="color:#f85149;font-weight:500;margin-bottom:4px">Failed to load statistics</div>
                <div style="color:var(--text-secondary);font-size:12px">${err.message}</div>
                <button id="dbRetryStats" style="margin-top:10px;padding:6px 16px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:12px">Retry</button>
            </div>`;
            const retry = document.getElementById('dbRetryStats');
            if (retry) retry.addEventListener('click', () => loadStats());
        }
    }

    function _statCard(title, value, subtitle, barPct) {
        return `<div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:8px;padding:12px;text-align:center">
            <div style="color:var(--text-secondary);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">${title}</div>
            <div style="color:var(--text-primary);font-size:20px;font-weight:700;margin:4px 0">${value}</div>
            <div style="color:var(--text-secondary);font-size:11px">${subtitle}</div>
            ${barPct != null ? `<div style="background:var(--bg-secondary);border-radius:3px;height:4px;margin-top:6px;overflow:hidden">
                <div style="background:${barPct > 80 ? '#f85149' : barPct > 50 ? '#e5a00d' : '#2ea043'};height:100%;width:${barPct}%"></div>
            </div>` : ''}
        </div>`;
    }

    // ─── Duplicate Database Modal ───────────────────────────────────────
    function _showDuplicateModal() {
        const currentUrl = getActiveDbUrl();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'dbDuplicateModal';
        modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px">
            <h2 style="margin-bottom:6px;color:var(--text-primary)">Duplicate Database</h2>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
                Copy ALL data from the source database to a new Firebase Realtime Database.
                The source database will NOT be modified.
            </p>

            <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;margin-bottom:16px">
                <div style="color:#856404;font-size:13px;font-weight:500">Important</div>
                <ul style="color:#856404;font-size:12px;margin:6px 0 0;padding-left:18px">
                    <li>The destination database must already exist in Firebase Console</li>
                    <li>Security rules on the destination must allow writes</li>
                    <li>This operation may take several minutes for large databases</li>
                </ul>
            </div>

            <div style="margin-bottom:14px">
                <label style="display:block;margin-bottom:4px;color:var(--text-secondary);font-size:12px;font-weight:500">Source (current database):</label>
                <input type="text" value="${currentUrl}" disabled
                    style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);font-size:12px;font-family:monospace">
            </div>

            <div style="margin-bottom:14px">
                <label style="display:block;margin-bottom:4px;color:var(--text-secondary);font-size:12px;font-weight:500">Destination (new database URL):</label>
                <input type="text" id="dupDestUrl" placeholder="https://your-new-project-default-rtdb.firebaseio.com/"
                    style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;font-family:monospace">
            </div>

            <div id="dupProgress" style="display:none;margin-bottom:14px">
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:14px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                        <span id="dupStatusText" style="color:var(--text-secondary);font-size:12px">Preparing...</span>
                        <span id="dupPercent" style="color:var(--text-primary);font-size:12px;font-weight:500">0%</span>
                    </div>
                    <div style="background:var(--bg-secondary);border-radius:4px;height:8px;overflow:hidden">
                        <div id="dupProgressBar" style="background:linear-gradient(135deg,#00d4ff,#7b2cbf);height:100%;width:0%;transition:width 0.3s;border-radius:4px"></div>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button id="dupCancelBtn" onclick="document.getElementById('dbDuplicateModal')?.remove()"
                    style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:13px">Cancel</button>
                <button id="dupStartBtn"
                    style="padding:10px 20px;border:none;border-radius:8px;background:#e5a00d;color:#000;cursor:pointer;font-weight:600;font-size:13px">Start Duplication</button>
            </div>
        </div>`;
        document.body.appendChild(modal);

        document.getElementById('dupStartBtn').addEventListener('click', _executeDuplicate);
    }

    async function _executeDuplicate() {
        const dest = document.getElementById('dupDestUrl')?.value.trim();
        if (!dest) { UIManager.showToast('Enter destination URL', 'error'); return; }
        if (!dest.startsWith('https://') || !dest.includes('firebaseio.com')) {
            UIManager.showToast('URL must be a valid Firebase Realtime Database URL', 'error');
            return;
        }

        if (!confirm(`Duplicate ALL data to:\n${dest}\n\nThe source database will not be modified. Continue?`)) return;
        if (!confirm('SECOND CONFIRMATION: This may take several minutes. Proceed?')) return;

        const bar = document.getElementById('dupProgressBar');
        const status = document.getElementById('dupStatusText');
        const pct = document.getElementById('dupPercent');
        const startBtn = document.getElementById('dupStartBtn');
        const cancelBtn = document.getElementById('dupCancelBtn');

        document.getElementById('dupProgress').style.display = 'block';
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';

        try {
            status.textContent = 'Reading source database...';
            bar.style.width = '5%'; pct.textContent = '5%';

            // Read source data via REST (avoids SDK bandwidth counting)
            const dbUrl = getActiveDbUrl();
            const res = await _fetchWithAuth(`${dbUrl}/.json`);
            if (!res.ok) throw new Error(`Failed to read source: HTTP ${res.status}`);
            const data = await res.json();
            if (!data) throw new Error('Source database is empty');

            bar.style.width = '20%'; pct.textContent = '20%';
            status.textContent = 'Connecting to destination...';

            // Initialize destination Firebase app
            const destApp = firebase.initializeApp({ ...FIREBASE_CONFIG, databaseURL: dest }, 'duplicateDest_' + Date.now());
            const destDb = destApp.database();

            // Write each top-level node independently (shows progress per node)
            const keys = Object.keys(data);
            for (let i = 0; i < keys.length; i++) {
                status.textContent = `Writing /${keys[i]}... (${i + 1}/${keys.length})`;
                await destDb.ref(keys[i]).set(data[keys[i]]);
                const progress = 20 + Math.floor(75 * (i + 1) / keys.length);
                bar.style.width = `${progress}%`;
                pct.textContent = `${progress}%`;
            }

            await destApp.delete();
            bar.style.width = '100%'; pct.textContent = '100%';
            status.textContent = 'Duplication completed successfully!';
            status.style.color = '#2ea043';

            UIManager.showToast('Database duplicated successfully!', 'success');
            cancelBtn.textContent = 'Close';

        } catch (e) {
            status.textContent = 'Failed: ' + e.message;
            status.style.color = '#f85149';
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
        }
    }

    // ─── Change Root Database Modal ─────────────────────────────────────
    function _showChangeRootModal() {
        const currentUrl = getActiveDbUrl();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'dbChangeRootModal';
        modal.innerHTML = `
        <div class="modal-content" style="max-width:600px;background:var(--bg-secondary);border:2px solid #f85149;border-radius:12px;padding:24px">
            <h2 style="margin-bottom:6px;color:#f85149">Change Root Database</h2>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
                Switch the ENTIRE MunHub application to a different Firebase Realtime Database.
                This affects the current session. Other users and terminals must reconnect.
            </p>

            <div style="background:#2d1b1b;border:2px solid #f85149;border-radius:8px;padding:14px;margin-bottom:16px">
                <div style="color:#f85149;font-size:14px;font-weight:700;margin-bottom:6px">CRITICAL WARNING</div>
                <ul style="color:#ff6b6b;font-size:12px;margin:0;padding-left:18px;line-height:1.6">
                    <li>All active terminals will lose connection and must be restarted</li>
                    <li>Any ongoing recordings will be interrupted</li>
                    <li>The app will reload and connect to the new database</li>
                    <li>Make sure data has been duplicated to the new DB first</li>
                    <li>You can revert by changing back to the old URL</li>
                </ul>
            </div>

            <div style="margin-bottom:14px">
                <label style="display:block;margin-bottom:4px;color:var(--text-secondary);font-size:12px;font-weight:500">Current database (old):</label>
                <input type="text" value="${currentUrl}" disabled
                    style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);font-size:12px;font-family:monospace">
            </div>

            <div style="margin-bottom:14px">
                <label style="display:block;margin-bottom:4px;color:var(--text-secondary);font-size:12px;font-weight:500">New database URL:</label>
                <input type="text" id="changeRootNewUrl" placeholder="https://your-new-project-default-rtdb.firebaseio.com/"
                    style="width:100%;padding:10px;border:1px solid #f85149;border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:13px;font-family:monospace">
            </div>

            <div style="margin-bottom:14px">
                <label style="display:block;margin-bottom:4px;color:var(--text-secondary);font-size:12px;font-weight:500">Verification: type <code style="color:#f85149">CHANGE DATABASE</code> to confirm:</label>
                <input type="text" id="changeRootConfirmText" placeholder="Type CHANGE DATABASE"
                    style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:13px">
            </div>

            <div id="changeRootTestResult" style="display:none;margin-bottom:14px;padding:10px;border-radius:8px;font-size:12px"></div>

            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button onclick="document.getElementById('dbChangeRootModal')?.remove()"
                    style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:13px">Cancel</button>
                <button id="changeRootTestBtn"
                    style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:13px">Test Connection</button>
                <button id="changeRootApplyBtn"
                    style="padding:10px 20px;border:none;border-radius:8px;background:#f85149;color:white;cursor:pointer;font-weight:600;font-size:13px">Apply &amp; Reload</button>
            </div>
        </div>`;
        document.body.appendChild(modal);

        document.getElementById('changeRootTestBtn').addEventListener('click', _testNewConnection);
        document.getElementById('changeRootApplyBtn').addEventListener('click', _applyRootChange);
    }

    async function _testNewConnection() {
        const newUrl = document.getElementById('changeRootNewUrl')?.value.trim();
        const result = document.getElementById('changeRootTestResult');
        if (!newUrl) { UIManager.showToast('Enter the new database URL', 'error'); return; }

        result.style.display = 'block';
        result.style.background = '#1a3a4a';
        result.style.color = 'var(--text-secondary)';
        result.textContent = 'Testing connection...';

        try {
            const res = await _fetchWithAuth(`${newUrl}/.json?shallow=true`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const data = await res.json();
            const keys = data ? Object.keys(data) : [];

            result.style.background = '#1a3a1a';
            result.style.color = '#2ea043';
            result.innerHTML = `Connection successful! Found ${keys.length} top-level nodes: <code style="color:#2ea043">${keys.join(', ') || '(empty)'}</code>`;
        } catch (e) {
            result.style.background = '#2d1b1b';
            result.style.color = '#f85149';
            result.textContent = 'Connection failed: ' + e.message;
        }
    }

    function _applyRootChange() {
        const newUrl = document.getElementById('changeRootNewUrl')?.value.trim();
        const confirm = document.getElementById('changeRootConfirmText')?.value.trim();

        if (!newUrl) { UIManager.showToast('Enter the new database URL', 'error'); return; }
        if (!newUrl.startsWith('https://') || !newUrl.includes('firebaseio.com')) {
            UIManager.showToast('Invalid Firebase Realtime Database URL', 'error');
            return;
        }
        if (confirm !== 'CHANGE DATABASE') {
            UIManager.showToast('Type "CHANGE DATABASE" exactly to confirm', 'error');
            return;
        }

        if (!window.confirm('FINAL WARNING: The application will reload and connect to the NEW database.\n\nAll active terminals must be restarted.\n\nProceed?')) return;

        // Save new URL and reload
        localStorage.setItem('munra_firebase_url', newUrl);
        UIManager.showToast('Database URL changed. Reloading...', 'success');
        setTimeout(() => location.reload(), 1000);
    }

    // ─── Event Listeners ────────────────────────────────────────────────
    function _attachEventListeners() {
        const refreshBtn = document.getElementById('dbRefreshStats');
        if (refreshBtn) refreshBtn.addEventListener('click', () => loadStats());

        const dupBtn = document.getElementById('dbDuplicateBtn');
        if (dupBtn) dupBtn.addEventListener('click', () => _showDuplicateModal());

        const changeRootBtn = document.getElementById('dbChangeRootBtn');
        if (changeRootBtn) changeRootBtn.addEventListener('click', () => _showChangeRootModal());
    }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        renderPanel,
        loadStats,
        getActiveDbUrl
    });
})();
