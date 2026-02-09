/**
 * MuNRa 4.0 - Profile Manager
 * 
 * Owns profile CRUD, sharing, renaming, visibility management,
 * and the Manage Profiles modal.
 * 
 * Depends on: config.js, firebase-manager.js, data-manager.js, ui-manager.js, auth.js
 */

const ProfileManager = (() => {
    /** Cache of all loaded profiles (keyed by id). */
    let _allProfiles = {};

    function getAllProfiles() { return _allProfiles; }

    // ─── Load & Populate Dropdown ───────────────────────────────────────
    async function loadProfiles() {
        const db = FirebaseManager.getDb();
        if (!db) return;

        try {
            const snap = await db.ref('profiles').once('value');
            _allProfiles = snap.val() || {};
            _populateSelect();
            UIManager.setConnectionStatus('connected', 'Connected');
        } catch (err) {
            console.error('[ProfileManager] loadProfiles error:', err);
            UIManager.setConnectionStatus('error', 'Error loading');
        }
    }

    /** Bucket profiles and populate the sidebar tree + hidden select. */
    function _populateSelect() {
        // Keep hidden <select> for any legacy code
        const select = document.getElementById('profileSelect');
        if (select) select.innerHTML = '<option value="">Select</option>';

        const uid = window.currentUser?.uid || null;

        const buckets = { mine: [], shared: [], pub: [] };

        for (const [id, profile] of Object.entries(_allProfiles)) {
            if (typeof canAccessProfile === 'function' && !canAccessProfile(profile, id)) continue;

            const name = profile.name || profile.meta?.name || id;
            const vis  = profile.visibility === 'private' ? 'private' : 'public';
            const canWrite = typeof canEditProfile === 'function' ? canEditProfile(profile, id) : false;
            const info = { id, name, vis, profile, canWrite };

            const isOwner  = uid && profile.ownerUid === uid;
            const isShared = uid && profile.sharedWith?.[uid];

            if (isOwner)       buckets.mine.push(info);
            else if (isShared) buckets.shared.push(info);
            else               buckets.pub.push(info);
        }

        const alpha = (a, b) => a.name.localeCompare(b.name);
        buckets.mine.sort(alpha);
        buckets.shared.sort(alpha);
        buckets.pub.sort(alpha);

        // Fill hidden select (backwards-compat)
        const _addOpts = items => items.forEach(({ id, name }) => {
            const o = document.createElement('option');
            o.value = id; o.textContent = name;
            if (select) select.appendChild(o);
        });
        _addOpts(buckets.mine); _addOpts(buckets.shared); _addOpts(buckets.pub);

        // Populate sidebar tree
        _populateTree(buckets);

        // Restore saved selection
        const saved = localStorage.getItem('munra_profile');
        const all = [...buckets.mine, ...buckets.shared, ...buckets.pub];
        const accessible = Object.fromEntries(all.map(i => [i.id, 1]));

        let profileId = '';
        if (saved && accessible[saved]) {
            profileId = saved;
        } else {
            profileId = buckets.mine[0]?.id || buckets.shared[0]?.id || buckets.pub[0]?.id || '';
        }

        if (profileId) {
            if (select) select.value = profileId;
            selectProfile(profileId);
        }
    }

    /** Build sidebar tree items for each section. */
    function _populateTree(buckets) {
        const curProfile = DataManager.getCurrentProfile();

        const fillSection = (sectionId, countId, items) => {
            const section = document.getElementById(sectionId);
            const countEl = document.getElementById(countId);
            const body = section?.querySelector('.tree-section-body');
            if (!body) return;

            body.innerHTML = '';
            if (countEl) countEl.textContent = items.length;

            if (!items.length) {
                body.innerHTML = '<div class="tree-item" style="opacity:0.5;cursor:default">No profiles</div>';
                return;
            }

            items.forEach(({ id, name, vis, canWrite }) => {
                const div = document.createElement('div');
                div.className = 'tree-item' + (id === curProfile ? ' active' : '');
                div.dataset.profileId = id;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'tree-item-name';
                nameSpan.textContent = name;

                const infoSpan = document.createElement('span');
                infoSpan.className = 'tree-item-info';
                // Show visibility icon + write/read-only indicator
                const visIcon = vis === 'private' ? '🔒' : '🌐';
                const accessIcon = canWrite ? '' : ' 👁';
                infoSpan.textContent = visIcon + accessIcon;
                if (!canWrite) {
                    infoSpan.title = 'Read only — cannot record data to this profile';
                    infoSpan.style.opacity = '0.7';
                }

                div.appendChild(nameSpan);
                div.appendChild(infoSpan);

                div.addEventListener('click', () => {
                    // Deselect all
                    document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
                    div.classList.add('active');
                    selectProfile(id);
                    // Update stat
                    const statName = document.getElementById('statProfileName');
                    if (statName) statName.textContent = name;
                });

                body.appendChild(div);
            });

            // Auto-open section if it has items
            if (items.length) section.classList.add('open');
        };

        fillSection('treeMyProfiles', 'countMine',   buckets.mine);
        fillSection('treeShared',     'countShared',  buckets.shared);
        fillSection('treePublic',     'countPublic',  buckets.pub);
    }

    /** Filter tree items by search query. */
    function filterProfiles(query) {
        const q = query.toLowerCase().trim();
        document.querySelectorAll('.tree-item[data-profile-id]').forEach(el => {
            const name = el.querySelector('.tree-item-name')?.textContent.toLowerCase() || '';
            el.style.display = (!q || name.includes(q)) ? '' : 'none';
        });
    }

    function selectProfile(id) {
        localStorage.setItem('munra_profile', id);
        _trackRecent(id);
        DataManager.subscribeToProfile(id);
    }

    function _trackRecent(id) {
        if (!id) return;
        let r = JSON.parse(localStorage.getItem('munra_recent_profiles') || '[]');
        r = r.filter(x => x !== id);
        r.unshift(id);
        localStorage.setItem('munra_recent_profiles', JSON.stringify(r.slice(0, 10)));
    }

    // ─── Create Profile ─────────────────────────────────────────────────
    function showCreateModal() {
        if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
            UIManager.showToast('You must be logged in to create profiles', 'error');
            return;
        }

        const modal = _overlay('createProfileModal', `
            <h2 style="margin-bottom:20px;color:var(--text-primary);">Create New Profile</h2>
            <div style="margin-bottom:15px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">Profile Name:</label>
                <input type="text" id="newProfileName" placeholder="e.g., COSMIC-2"
                       style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">
            </div>
            <div style="margin-bottom:15px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">Profile ID (optional):</label>
                <input type="text" id="newProfileId" placeholder="auto-generated from name"
                       style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">
                <small style="color:var(--text-secondary);font-size:11px">Leave empty to auto-generate</small>
            </div>
            <div style="margin-bottom:20px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">Visibility:</label>
                <select id="newProfileVisibility"
                        style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">
                    <option value="private" selected>Private (only you)</option>
                    <option value="public">Public (everyone)</option>
                </select>
            </div>
            <div id="createProfileStatus" style="margin-bottom:15px;padding:10px;border-radius:8px;display:none"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button onclick="ProfileManager.closeModal('createProfileModal')"
                        style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:14px">Cancel</button>
                <button onclick="ProfileManager.createNew()"
                        style="padding:10px 20px;border:none;border-radius:8px;background:linear-gradient(135deg,#00d4ff,#7b2cbf);color:white;cursor:pointer;font-weight:600;font-size:14px">Create</button>
            </div>
        `);
        document.body.appendChild(modal);
        document.getElementById('newProfileName').focus();
    }

    async function createNew() {
        const name = document.getElementById('newProfileName').value.trim();
        const status = document.getElementById('createProfileStatus');
        if (!name) { _status(status, '#ff4444', 'Profile name is required'); return; }

        let id = document.getElementById('newProfileId').value.trim();
        if (!id) id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
        if (_allProfiles[id]) { _status(status, '#ff4444', 'A profile with this ID already exists'); return; }

        _status(status, '#2196F3', '⏳ Creating…');

        try {
            const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const userData = typeof getCurrentUserData === 'function' ? getCurrentUserData() : null;
            const vis = document.getElementById('newProfileVisibility').value;
            const now = new Date().toISOString();

            const data = {
                name,
                visibility: vis,
                meta: { name, created_at: now, updated_at: now }
            };
            if (user) {
                data.ownerUid = user.uid;
                data.ownerEmail = user.email;
                data.ownerName = userData?.displayName || user.email;
            }

            await FirebaseManager.getDb().ref(`profiles/${id}`).set(data);
            _status(status, '#4CAF50', 'Profile created!');

            setTimeout(() => {
                closeModal('createProfileModal');
                loadProfiles();
                setTimeout(() => {
                    document.getElementById('profileSelect').value = id;
                    selectProfile(id);
                }, 400);
            }, 800);
        } catch (err) {
            _status(status, '#ff4444', 'Error: ' + err.message);
        }
    }

    // ─── Manage Profiles Modal ──────────────────────────────────────────
    function showManageModal() {
        if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
            UIManager.showToast('You must be logged in to manage profiles', 'error');
            return;
        }

        let html = '';
        let count = 0;
        const curProfile = DataManager.getCurrentProfile();

        for (const [id, profile] of Object.entries(_allProfiles)) {
            if (typeof isProfileOwner === 'function' && !isProfileOwner(profile, id)) continue;
            count++;

            const name = profile.name || profile.meta?.name || id;
            const isSel = id === curProfile;
            const vis = profile.visibility === 'private' ? 'Private' : 'Public';
            const newVis = profile.visibility === 'private' ? 'PUBLIC' : 'PRIVATE';
            const visColor = profile.visibility === 'private' ? '#e5a00d' : '#2ea043';
            const shared = profile.sharedWith ? Object.keys(profile.sharedWith).length : 0;

            html += `
            <div style="background:var(--bg-tertiary);border-radius:8px;border:1px solid ${isSel ? '#00d4ff' : 'var(--border-color)'};margin-bottom:12px;overflow:hidden">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;flex-wrap:wrap;gap:8px">
                <div>
                  <div style="font-weight:500;color:var(--text-primary)">${name}</div>
                  <div style="font-size:11px;color:var(--text-secondary)">ID: ${id} | ${vis}${shared ? ` | Shared: ${shared}` : ''}</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
                  <button onclick="ProfileManager.showRenameModal('${id}','${_esc(name)}')"
                    style="padding:6px 12px;border:none;border-radius:6px;background:#0d6efd;color:white;cursor:pointer;font-size:11px">Rename ID</button>
                  <button onclick="ProfileManager.toggleVisibility('${id}')"
                    style="padding:6px 12px;border:none;border-radius:6px;background:${visColor};color:white;cursor:pointer;font-size:11px">Set ${newVis}</button>
                  <button onclick="ProfileManager.toggleSharePanel('${id}')"
                    style="padding:6px 12px;border:none;border-radius:6px;background:#7b2cbf;color:white;cursor:pointer;font-size:11px">Share</button>
                  <button onclick="ProfileManager.deleteProfile('${id}','${_esc(name)}')"
                    ${isSel ? 'disabled title="Cannot delete selected"' : ''}
                    style="padding:6px 12px;border:none;border-radius:6px;background:#f85149;color:white;cursor:pointer;font-size:11px">Delete</button>
                </div>
              </div>
              <div id="sharePanel_${id}" style="display:none;padding:12px;border-top:1px solid var(--border-color);background:var(--bg-secondary)">
                <div style="margin-bottom:10px">
                  <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px">Invite user (email or username):</label>
                  <div style="display:flex;gap:8px">
                    <input type="text" id="shareInput_${id}" placeholder="Enter email or username"
                      style="flex:1;padding:8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-tertiary);color:var(--text-primary);font-size:13px">
                    <select id="shareAccess_${id}" style="padding:8px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-tertiary);color:var(--text-primary);font-size:13px">
                      <option value="view">View Only</option>
                      <option value="edit">Can Edit</option>
                    </select>
                    <button onclick="ProfileManager.shareWith('${id}')"
                      style="padding:8px 16px;border:none;border-radius:6px;background:linear-gradient(135deg,#00d4ff,#7b2cbf);color:white;cursor:pointer;font-size:13px;font-weight:500">Invite</button>
                  </div>
                </div>
                <div id="sharedList_${id}"></div>
              </div>
            </div>`;
        }

        if (!count) html = '<p style="color:var(--text-secondary);text-align:center">No profiles owned. Create one first!</p>';

        const modal = _overlay('manageProfilesModal', `
            <h2 style="margin-bottom:20px;color:var(--text-primary)">Manage My Profiles</h2>
            <div style="max-height:500px;overflow-y:auto;margin-bottom:20px">${html}</div>
            <div style="display:flex;justify-content:flex-end">
                <button onclick="ProfileManager.closeModal('manageProfilesModal')"
                    style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:14px">Close</button>
            </div>
        `);
        document.body.appendChild(modal);
    }

    function toggleSharePanel(id) {
        const el = document.getElementById(`sharePanel_${id}`);
        if (!el) return;
        if (el.style.display === 'none') { el.style.display = 'block'; _loadSharedList(id); }
        else el.style.display = 'none';
    }

    async function _loadSharedList(id) {
        const div = document.getElementById(`sharedList_${id}`);
        if (!div) return;
        const shared = _allProfiles[id]?.sharedWith || {};
        if (!Object.keys(shared).length) { div.innerHTML = '<p style="color:var(--text-secondary);font-size:12px;margin:0">No one has access yet</p>'; return; }

        let h = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Shared with:</div>';
        for (const [uid, access] of Object.entries(shared)) {
            try {
                const u = (await FirebaseManager.getDb().ref(`users/${uid}`).once('value')).val();
                if (u) h += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg-tertiary);border-radius:4px;margin-bottom:4px">
                    <span style="color:var(--text-primary);font-size:13px">${u.displayName || u.email}</span>
                    <div style="display:flex;align-items:center;gap:6px">
                        <span style="font-size:11px;color:var(--text-secondary)">${access === 'edit' ? 'Can edit' : 'View only'}</span>
                        <button onclick="ProfileManager.removeShare('${id}','${uid}')"
                            style="padding:2px 6px;border:none;border-radius:4px;background:#f85149;color:white;cursor:pointer;font-size:11px">X</button>
                    </div></div>`;
            } catch (e) { /* skip */ }
        }
        div.innerHTML = h;
    }

    async function shareWith(id) {
        const input = document.getElementById(`shareInput_${id}`);
        const access = document.getElementById(`shareAccess_${id}`);
        if (!input || !access) return;
        const search = input.value.trim();
        if (!search) { UIManager.showToast('Enter an email or username', 'error'); return; }

        try {
            const snap = await FirebaseManager.getDb().ref('users').once('value');
            const users = snap.val() || {};
            let foundUid = null, foundUser = null;
            for (const [uid, u] of Object.entries(users)) {
                if (u.email === search || u.displayName === search) { foundUid = uid; foundUser = u; break; }
            }
            if (!foundUid) { UIManager.showToast('User not found. Must register first.', 'error'); return; }

            await FirebaseManager.getDb().ref(`profiles/${id}/sharedWith/${foundUid}`).set(access.value);
            if (!_allProfiles[id].sharedWith) _allProfiles[id].sharedWith = {};
            _allProfiles[id].sharedWith[foundUid] = access.value;
            input.value = '';
            UIManager.showToast(`Shared with ${foundUser.displayName || foundUser.email}`, 'success');
            _loadSharedList(id);
        } catch (e) { UIManager.showToast('Error sharing', 'error'); }
    }

    async function removeShare(id, uid) {
        try {
            await FirebaseManager.getDb().ref(`profiles/${id}/sharedWith/${uid}`).remove();
            if (_allProfiles[id]?.sharedWith) delete _allProfiles[id].sharedWith[uid];
            UIManager.showToast('Access removed', 'success');
            _loadSharedList(id);
        } catch (e) { UIManager.showToast('Error', 'error'); }
    }

    // ─── Visibility Toggle ──────────────────────────────────────────────
    async function toggleVisibility(id) {
        const p = _allProfiles[id];
        if (!p) return;
        const newVis = p.visibility === 'private' ? 'public' : 'private';
        const msg = newVis === 'public'
            ? `Make "${p.name || id}" PUBLIC? Anyone can view it.`
            : `Make "${p.name || id}" PRIVATE? Only you and shared users can see it.`;
        if (!confirm(msg)) return;

        try {
            await FirebaseManager.getDb().ref(`profiles/${id}/visibility`).set(newVis);
            _allProfiles[id].visibility = newVis;
            UIManager.showToast(`Profile is now ${newVis}`, 'success');
            closeModal('manageProfilesModal');
            showManageModal();
        } catch (e) { UIManager.showToast('Error', 'error'); }
    }

    // ─── Delete Profile ─────────────────────────────────────────────────
    async function deleteProfile(id, name) {
        if (!confirm(`Delete "${name}" (${id})? All data will be lost!`)) return;
        try {
            await FirebaseManager.getDb().ref(`profiles/${id}`).remove();
            if (DataManager.getCurrentProfile() === id) {
                DataManager.disconnect();
                localStorage.removeItem('munra_profile');
            }
            UIManager.showToast('Profile deleted', 'success');
            closeModal('manageProfilesModal');
            loadProfiles();
        } catch (e) { UIManager.showToast('Error: ' + e.message, 'error'); }
    }

    // ─── Rename Profile ID ──────────────────────────────────────────────
    function showRenameModal(oldId, name) {
        const modal = _overlay('renameProfileModal', `
            <h2 style="margin-bottom:15px;color:var(--text-primary)">Rename Profile ID</h2>
            <div style="background:#fff3cd;color:#856404;padding:12px;border-radius:8px;margin-bottom:15px;font-size:13px">
                <strong>Warning:</strong> All data migrates to the new ID. Old ID is deleted.
            </div>
            <div style="margin-bottom:15px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">Current ID:</label>
                <input type="text" value="${oldId}" disabled style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-secondary);font-size:14px">
            </div>
            <div style="margin-bottom:20px">
                <label style="display:block;margin-bottom:5px;color:var(--text-secondary);font-size:14px">New Profile ID:</label>
                <input type="text" id="newProfileIdInput" placeholder="lowercase, no spaces"
                    style="width:100%;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);font-size:14px">
            </div>
            <div id="renameStatus" style="margin-bottom:15px;padding:10px;border-radius:8px;display:none"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button onclick="ProfileManager.closeModal('renameProfileModal')"
                    style="padding:10px 20px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-tertiary);color:var(--text-primary);cursor:pointer;font-size:14px">Cancel</button>
                <button onclick="ProfileManager.executeRename('${oldId}')"
                    style="padding:10px 20px;border:none;border-radius:8px;background:#0d6efd;color:white;cursor:pointer;font-weight:600;font-size:14px">Rename</button>
            </div>
        `);
        document.body.appendChild(modal);
        document.getElementById('newProfileIdInput').focus();
    }

    async function executeRename(oldId) {
        const input = document.getElementById('newProfileIdInput');
        const status = document.getElementById('renameStatus');
        let newId = input.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        input.value = newId;
        if (!newId) { _status(status, '#ff4444', 'New ID is required'); return; }
        if (newId === oldId) { _status(status, '#ff4444', 'Must be different from current'); return; }
        if (_allProfiles[newId]) { _status(status, '#ff4444', 'ID already exists'); return; }
        if (!confirm(`Rename "${oldId}" → "${newId}"? All data migrates.`)) return;

        _status(status, '#2196F3', 'Migrating…');
        const db = FirebaseManager.getDb();
        try {
            const snap = await db.ref(`profiles/${oldId}`).once('value');
            if (!snap.val()) throw new Error('Old profile not found');
            await db.ref(`profiles/${newId}`).set(snap.val());
            const verify = await db.ref(`profiles/${newId}`).once('value');
            if (!verify.exists()) throw new Error('Verification failed');
            await db.ref(`profiles/${oldId}`).remove();

            if (DataManager.getCurrentProfile() === oldId) {
                localStorage.setItem('munra_profile', newId);
            }
            let recent = JSON.parse(localStorage.getItem('munra_recent_profiles') || '[]');
            localStorage.setItem('munra_recent_profiles', JSON.stringify(recent.map(r => r === oldId ? newId : r)));

            _status(status, '#4CAF50', 'Renamed!');
            UIManager.showToast('Profile renamed', 'success');
            setTimeout(() => { closeModal('renameProfileModal'); closeModal('manageProfilesModal'); loadProfiles(); }, 1200);
        } catch (e) {
            _status(status, '#ff4444', 'Error: ' + e.message);
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────
    function _overlay(id, inner) {
        const d = document.createElement('div');
        d.className = 'modal-overlay';
        d.id = id;
        d.innerHTML = `<div class="modal-content" style="max-width:500px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:12px;padding:24px">${inner}</div>`;
        return d;
    }

    function closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.remove();
    }

    function _status(el, bg, text) {
        el.style.display = 'block'; el.style.background = bg;
        el.style.color = 'white'; el.textContent = text;
    }

    function _esc(s) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

    // ─── Public API ─────────────────────────────────────────────────────
    return Object.freeze({
        getAllProfiles,
        loadProfiles,
        selectProfile,
        filterProfiles,
        showCreateModal,
        createNew,
        showManageModal,
        toggleSharePanel,
        shareWith,
        removeShare,
        toggleVisibility,
        deleteProfile,
        showRenameModal,
        executeRename,
        closeModal
    });
})();
