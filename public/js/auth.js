/**
 * MuNRa Auth System v4.0
 * Firebase Authentication + User Management + Profile Sharing + i18n
 * 
 * SECURITY: Roles are stored in Firebase database, NOT hardcoded.
 * To make a user admin, set their role in Firebase: users/{uid}/role = 'admin'
 */

// Auth state
let auth = null;
let currentUser = null;
let currentUserData = null;
let isRegistering = false; // Flag to prevent race condition

// REMOVED: Hardcoded ADMIN_UID - roles are now read from database only
// To set up initial admin: Manually set users/{uid}/role to 'admin' in Firebase Console

// i18n - Translations
const translations = {
    en: {
        // Auth
        login: 'Login',
        logout: 'Logout',
        register: 'Register',
        createAccount: 'Create Account',
        resetPassword: 'Reset Password',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        displayName: 'Display Name',
        forgotPassword: 'Forgot password?',
        alreadyHaveAccount: 'Already have an account?',
        noAccount: 'Create account',
        backToLogin: 'Back to login',
        sendResetLink: 'Send Reset Link',
        // User menu
        userSettings: 'User Settings',
        adminPanel: 'Admin Panel',
        // Settings
        settings: 'Settings',
        language: 'Language',
        timezone: 'Timezone',
        database: 'Database',
        defaultDatabase: 'Default (MuNRa)',
        customDatabase: 'Custom URL',
        databaseUrl: 'Database URL',
        applyConnect: 'Apply & Connect',
        dataManagement: 'Data Management',
        uploadSession: 'Upload Session File',
        uploadProfile: 'Upload Profile (ZIP)',
        exportData: 'Export All Data (CSV)',
        storageStats: 'Storage Statistics',
        minutesStored: 'Minutes stored',
        realtimeEntries: 'Realtime entries',
        connection: 'Connection',
        // Profiles
        createProfile: 'Create New Profile',
        profileName: 'Profile Name',
        profileId: 'Profile ID (optional)',
        visibility: 'Visibility',
        public: 'Public',
        private: 'Private',
        cancel: 'Cancel',
        create: 'Create',
        manageProfiles: 'Manage Profiles',
        delete: 'Delete',
        share: 'Share',
        owner: 'Owner',
        sharedWith: 'Shared With',
        viewOnly: 'View Only',
        canEdit: 'Can Edit',
        inviteUser: 'Invite user by email or username',
        invite: 'Invite',
        noAccess: 'No one has access yet',
        removeAccess: 'Remove access',
        // Admin
        users: 'Users',
        profiles: 'Profiles',
        role: 'Role',
        user: 'User',
        admin: 'Admin',
        actions: 'Actions',
        protected: 'Protected',
        editOwner: 'Edit Owner',
        confirmEditOwner: 'Are you sure you want to change the owner of this profile?',
        assignOwner: 'Assign Owner',
        enterEmailOrUsername: 'Enter email or username',
        migrateDatabase: 'Migrate Database',
        confirmMigrate: 'This will copy ALL data to a new database. Are you sure?',
        // Messages
        loggedInSuccess: 'Logged in successfully',
        loggedOutSuccess: 'Logged out successfully',
        accountCreated: 'Account created successfully',
        resetEmailSent: 'Password reset email sent',
        settingsSaved: 'Settings saved',
        profileCreated: 'Profile created successfully',
        profileDeleted: 'Profile deleted',
        invitationSent: 'Invitation sent',
        accessRemoved: 'Access removed',
        ownerUpdated: 'Owner updated',
        visibilityUpdated: 'Visibility updated',
        roleUpdated: 'Role updated',
        userDeleted: 'User deleted',
        userNotFound: 'User not found. They must register first.',
        accessDenied: 'Access denied',
        error: 'Error',
        // Errors
        emailRequired: 'Email is required',
        passwordRequired: 'Password is required',
        nameRequired: 'Display name is required',
        passwordsNoMatch: 'Passwords do not match',
        profileNameRequired: 'Profile name is required',
        profileExists: 'A profile with this ID already exists'
    },
    es: {
        // Auth
        login: 'Iniciar Sesión',
        logout: 'Cerrar Sesión',
        register: 'Registrarse',
        createAccount: 'Crear Cuenta',
        resetPassword: 'Restablecer Contraseña',
        email: 'Correo Electrónico',
        password: 'Contraseña',
        confirmPassword: 'Confirmar Contraseña',
        displayName: 'Nombre de Usuario',
        forgotPassword: '¿Olvidaste tu contraseña?',
        alreadyHaveAccount: '¿Ya tienes una cuenta?',
        noAccount: 'Crear cuenta',
        backToLogin: 'Volver al login',
        sendResetLink: 'Enviar Enlace',
        // User menu
        userSettings: 'Configuración de Usuario',
        adminPanel: 'Panel de Administrador',
        // Settings
        settings: 'Ajustes',
        language: 'Idioma',
        timezone: 'Zona Horaria',
        database: 'Base de Datos',
        defaultDatabase: 'Predeterminada (MuNRa)',
        customDatabase: 'URL Personalizada',
        databaseUrl: 'URL de Base de Datos',
        applyConnect: 'Aplicar y Conectar',
        dataManagement: 'Gestión de Datos',
        uploadSession: 'Subir Archivo de Sesión',
        uploadProfile: 'Subir Perfil (ZIP)',
        exportData: 'Exportar Todos los Datos (CSV)',
        storageStats: 'Estadísticas de Almacenamiento',
        minutesStored: 'Minutos almacenados',
        realtimeEntries: 'Entradas en tiempo real',
        connection: 'Conexión',
        // Profiles
        createProfile: 'Crear Nuevo Perfil',
        profileName: 'Nombre del Perfil',
        profileId: 'ID del Perfil (opcional)',
        visibility: 'Visibilidad',
        public: 'Público',
        private: 'Privado',
        cancel: 'Cancelar',
        create: 'Crear',
        manageProfiles: 'Administrar Perfiles',
        delete: 'Eliminar',
        share: 'Compartir',
        owner: 'Propietario',
        sharedWith: 'Compartido con',
        viewOnly: 'Solo Ver',
        canEdit: 'Puede Editar',
        inviteUser: 'Invitar usuario por correo o nombre',
        invite: 'Invitar',
        noAccess: 'Nadie tiene acceso aún',
        removeAccess: 'Quitar acceso',
        // Admin
        users: 'Usuarios',
        profiles: 'Perfiles',
        role: 'Rol',
        user: 'Usuario',
        admin: 'Administrador',
        actions: 'Acciones',
        protected: 'Protegido',
        editOwner: 'Editar Propietario',
        confirmEditOwner: '¿Estás seguro de cambiar el propietario de este perfil?',
        assignOwner: 'Asignar Propietario',
        enterEmailOrUsername: 'Ingresa correo o nombre de usuario',
        migrateDatabase: 'Migrar Base de Datos',
        confirmMigrate: 'Esto copiará TODOS los datos a una nueva base de datos. ¿Estás seguro?',
        // Messages
        loggedInSuccess: 'Sesión iniciada correctamente',
        loggedOutSuccess: 'Sesión cerrada correctamente',
        accountCreated: 'Cuenta creada correctamente',
        resetEmailSent: 'Correo de restablecimiento enviado',
        settingsSaved: 'Ajustes guardados',
        profileCreated: 'Perfil creado correctamente',
        profileDeleted: 'Perfil eliminado',
        invitationSent: 'Invitación enviada',
        accessRemoved: 'Acceso eliminado',
        ownerUpdated: 'Propietario actualizado',
        visibilityUpdated: 'Visibilidad actualizada',
        roleUpdated: 'Rol actualizado',
        userDeleted: 'Usuario eliminado',
        userNotFound: 'Usuario no encontrado. Debe registrarse primero.',
        accessDenied: 'Acceso denegado',
        error: 'Error',
        // Errors
        emailRequired: 'El correo es requerido',
        passwordRequired: 'La contraseña es requerida',
        nameRequired: 'El nombre de usuario es requerido',
        passwordsNoMatch: 'Las contraseñas no coinciden',
        profileNameRequired: 'El nombre del perfil es requerido',
        profileExists: 'Ya existe un perfil con este ID'
    }
};

let currentLanguage = localStorage.getItem('munra_language') || 'es';

function t(key) {
    return translations[currentLanguage]?.[key] || translations['en'][key] || key;
}

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('munra_language', lang);
    // Update UI elements that need translation
    updateUILanguage();
}

function updateUILanguage() {
    // Update static text elements
    const langElements = document.querySelectorAll('[data-i18n]');
    langElements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
function initAuth() {
    console.log('Initializing Auth...');
    
    // Wait for Firebase to be ready
    if (!firebase.apps.length) {
        console.log('Firebase not ready, waiting...');
        setTimeout(initAuth, 200);
        return;
    }
    
    auth = firebase.auth();
    
    // Listen for auth state changes
    auth.onAuthStateChanged(handleAuthStateChanged);
    
    // Setup auth UI event listeners
    setupAuthListeners();
    
    console.log('Auth initialized successfully');
}

function handleAuthStateChanged(user) {
    console.log('Auth state changed:', user ? user.email : 'logged out');
    
    // If we're in the middle of registration, wait for it to complete
    if (isRegistering) {
        console.log('Registration in progress, skipping auth state change');
        return;
    }
    
    currentUser = user;
    
    if (user) {
        // User is signed in
        loadUserData(user.uid).then(userData => {
            currentUserData = userData;
            updateUIForLoggedInUser(user, userData);
            // Reload profiles to filter by permissions
            if (typeof loadProfiles === 'function') {
                loadProfiles();
            }
        });
    } else {
        // User is signed out
        currentUserData = null;
        updateUIForLoggedOutUser();
        // Reload profiles to show only public
        if (typeof loadProfiles === 'function') {
            loadProfiles();
        }
    }
}

async function loadUserData(uid) {
    try {
        const snapshot = await firebase.database().ref(`users/${uid}`).once('value');
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            // User data doesn't exist yet - create with default 'user' role
            // Admins must be set manually in Firebase Console for security
            const defaultData = {
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                role: 'user', // Default role - admins set manually in Firebase Console
                createdAt: Date.now()
            };
            await firebase.database().ref(`users/${uid}`).set(defaultData);
            return defaultData;
        }
    } catch (e) {
        console.error('Error loading user data:', e);
        return { role: 'user' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI UPDATES
// ═══════════════════════════════════════════════════════════════════════════════
function updateUIForLoggedInUser(user, userData) {
    // Hide login button, show user menu
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    if (loginBtn) loginBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    
    // Update user info
    const displayName = userData?.displayName || user.displayName || user.email.split('@')[0];
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (userNameEl) userNameEl.textContent = displayName;
    if (userEmailEl) userEmailEl.textContent = user.email;
    if (userAvatarEl) userAvatarEl.textContent = displayName.charAt(0).toUpperCase();
    
    // Show role
    const role = userData?.role || 'user';
    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) {
        userRoleEl.textContent = role;
        userRoleEl.className = 'user-role role-' + role;
    }
    
    // Show admin button if admin
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) {
        adminBtn.style.display = role === 'admin' ? 'flex' : 'none';
    }
    
    // Show profile management buttons for logged in users
    const addProfileBtn = document.getElementById('addProfileBtn');
    const manageProfilesBtn = document.getElementById('manageProfilesBtn');
    if (addProfileBtn) addProfileBtn.style.display = 'flex';
    if (manageProfilesBtn) manageProfilesBtn.style.display = 'flex';
    
    // Show serial terminal button for logged in users
    const serialTerminalBtn = document.getElementById('serialTerminalBtn');
    if (serialTerminalBtn) serialTerminalBtn.style.display = 'flex';
    
    // Close auth modal if open
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.remove('active');
}

function updateUIForLoggedOutUser() {
    // Show login button, hide user menu
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const adminBtn = document.getElementById('adminPanelBtn');
    
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    
    // HIDE profile management buttons for guests
    const addProfileBtn = document.getElementById('addProfileBtn');
    const manageProfilesBtn = document.getElementById('manageProfilesBtn');
    if (addProfileBtn) addProfileBtn.style.display = 'none';
    if (manageProfilesBtn) manageProfilesBtn.style.display = 'none';
    
    // HIDE serial terminal button for guests
    const serialTerminalBtn = document.getElementById('serialTerminalBtn');
    if (serialTerminalBtn) serialTerminalBtn.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════
function setupAuthListeners() {
    // Login button - use event delegation for reliability
    document.addEventListener('click', (e) => {
        if (e.target.closest('#loginBtn')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Login button clicked via delegation');
            showAuthForm('login');
            document.getElementById('authModal').classList.add('active');
        }
    });
    
    // Close auth modal
    const closeAuth = document.getElementById('closeAuth');
    if (closeAuth) {
        closeAuth.addEventListener('click', () => {
            document.getElementById('authModal').classList.remove('active');
            clearAuthError();
        });
    }
    
    // Click outside modal to close
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target.id === 'authModal') {
                authModal.classList.remove('active');
                clearAuthError();
            }
        });
    }
    
    // User menu dropdown
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.toggle('show');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            const dropdown = document.getElementById('userDropdown');
            if (dropdown) dropdown.classList.remove('show');
        }
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                showToast(t('loggedOutSuccess'), 'success');
            } catch (e) {
                showToast(t('error'), 'error');
            }
        });
    }
    
    // User Settings button
    const userSettingsBtn = document.getElementById('userSettingsBtn');
    if (userSettingsBtn) {
        userSettingsBtn.addEventListener('click', () => {
            document.getElementById('userDropdown').classList.remove('show');
            openUserSettingsModal();
        });
    }
    
    // Form switching
    document.addEventListener('click', (e) => {
        if (e.target.id === 'showRegister') { e.preventDefault(); showAuthForm('register'); }
        if (e.target.id === 'showForgot') { e.preventDefault(); showAuthForm('forgot'); }
        if (e.target.id === 'showLoginFromReg') { e.preventDefault(); showAuthForm('login'); }
        if (e.target.id === 'showLoginFromForgot') { e.preventDefault(); showAuthForm('login'); }
    });
    
    // Login form submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                await auth.signInWithEmailAndPassword(email, password);
                showToast(t('loggedInSuccess'), 'success');
                loginForm.reset();
            } catch (error) {
                showAuthError(getAuthErrorMessage(error.code));
            }
        });
    }
    
    // Register form submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirm = document.getElementById('registerConfirm').value;
            
            if (!name) {
                showAuthError(t('nameRequired'));
                return;
            }
            
            if (password !== confirm) {
                showAuthError(t('passwordsNoMatch'));
                return;
            }
            
            try {
                // Set flag to prevent race condition
                isRegistering = true;
                
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                
                // Create user data in database FIRST
                await firebase.database().ref(`users/${userCredential.user.uid}`).set({
                    email: email,
                    displayName: name,
                    role: 'user',
                    createdAt: Date.now()
                });
                
                // Update Firebase Auth profile
                await userCredential.user.updateProfile({ displayName: name });
                
                // Now set current user data manually
                currentUser = userCredential.user;
                currentUserData = {
                    email: email,
                    displayName: name,
                    role: 'user',
                    createdAt: Date.now()
                };
                
                // Clear registration flag
                isRegistering = false;
                
                // Update UI with correct name
                updateUIForLoggedInUser(currentUser, currentUserData);
                
                showToast(t('accountCreated'), 'success');
                registerForm.reset();
                
                // Reload profiles
                if (typeof loadProfiles === 'function') {
                    loadProfiles();
                }
                
            } catch (error) {
                isRegistering = false;
                showAuthError(getAuthErrorMessage(error.code));
            }
        });
    }
    
    // Forgot password form submit
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value;
            
            try {
                await auth.sendPasswordResetEmail(email);
                showToast(t('resetEmailSent'), 'success');
                showAuthForm('login');
                forgotForm.reset();
            } catch (error) {
                showAuthError(getAuthErrorMessage(error.code));
            }
        });
    }
    
    // Admin panel
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    if (adminPanelBtn) {
        adminPanelBtn.addEventListener('click', () => {
            document.getElementById('userDropdown').classList.remove('show');
            openAdminPanel();
        });
    }
    
    const closeAdmin = document.getElementById('closeAdmin');
    if (closeAdmin) {
        closeAdmin.addEventListener('click', () => {
            document.getElementById('adminModal').classList.remove('active');
        });
    }
    
    const adminModal = document.getElementById('adminModal');
    if (adminModal) {
        adminModal.addEventListener('click', (e) => {
            if (e.target.id === 'adminModal') {
                adminModal.classList.remove('active');
            }
        });
    }
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            document.getElementById('usersPanel').style.display = tabName === 'users' ? 'block' : 'none';
            document.getElementById('profilesPanel').style.display = tabName === 'profiles' ? 'block' : 'none';
            
            if (tabName === 'profiles') {
                loadAdminProfiles();
            }
        });
    });
}

function showAuthForm(formType) {
    const titles = { login: t('login'), register: t('createAccount'), forgot: t('resetPassword') };
    const titleEl = document.getElementById('authModalTitle');
    if (titleEl) titleEl.textContent = titles[formType];
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    
    if (loginForm) loginForm.style.display = formType === 'login' ? 'block' : 'none';
    if (registerForm) registerForm.style.display = formType === 'register' ? 'block' : 'none';
    if (forgotForm) forgotForm.style.display = formType === 'forgot' ? 'block' : 'none';
    
    clearAuthError();
}

function showAuthError(message) {
    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function clearAuthError() {
    const errorDiv = document.getElementById('authError');
    if (errorDiv) errorDiv.style.display = 'none';
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Email already in use / Email ya en uso',
        'auth/invalid-email': 'Invalid email / Email inválido',
        'auth/user-disabled': 'Account disabled / Cuenta deshabilitada',
        'auth/user-not-found': 'Account not found / Cuenta no encontrada',
        'auth/wrong-password': 'Incorrect password / Contraseña incorrecta',
        'auth/weak-password': 'Password too weak (min 6 chars) / Contraseña muy débil',
        'auth/too-many-requests': 'Too many attempts / Demasiados intentos',
        'auth/invalid-credential': 'Invalid credentials / Credenciales inválidas'
    };
    return messages[code] || 'An error occurred / Ocurrió un error';
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function openUserSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'userSettingsModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>${t('userSettings')}</h2>
                <button class="modal-close" onclick="closeUserSettingsModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="setting-group">
                    <label>${t('displayName')}</label>
                    <input type="text" id="settingsDisplayName" value="${currentUserData?.displayName || ''}" placeholder="${t('displayName')}">
                </div>
                <div class="setting-group">
                    <label>${t('email')} (cannot be changed)</label>
                    <input type="email" value="${currentUser?.email || ''}" disabled style="opacity: 0.6;">
                </div>
                <div class="setting-group">
                    <label>${t('language')}</label>
                    <select id="settingsLanguage">
                        <option value="es" ${currentLanguage === 'es' ? 'selected' : ''}>Español</option>
                        <option value="en" ${currentLanguage === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>
                <div class="setting-group" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="saveUserSettings()" style="width: 100%;">${t('settingsSaved').replace('saved', 'Save')}</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeUserSettingsModal();
    });
}

function closeUserSettingsModal() {
    const modal = document.getElementById('userSettingsModal');
    if (modal) modal.remove();
}

async function saveUserSettings() {
    const newName = document.getElementById('settingsDisplayName').value.trim();
    const newLanguage = document.getElementById('settingsLanguage').value;
    
    if (!newName) {
        showToast(t('nameRequired'), 'error');
        return;
    }
    
    try {
        // Update display name
        await currentUser.updateProfile({ displayName: newName });
        await firebase.database().ref(`users/${currentUser.uid}/displayName`).set(newName);
        currentUserData.displayName = newName;
        
        // Update UI
        document.getElementById('userName').textContent = newName;
        document.getElementById('userAvatar').textContent = newName.charAt(0).toUpperCase();
        
        // Update language
        setLanguage(newLanguage);
        
        showToast(t('settingsSaved'), 'success');
        closeUserSettingsModal();
    } catch (e) {
        showToast(t('error'), 'error');
        console.error(e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
async function openAdminPanel() {
    if (!currentUserData || currentUserData.role !== 'admin') {
        showToast(t('accessDenied'), 'error');
        return;
    }
    
    document.getElementById('adminModal').classList.add('active');
    await loadAdminUsers();
}

async function loadAdminUsers() {
    try {
        const snapshot = await firebase.database().ref('users').once('value');
        const users = snapshot.val() || {};
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        Object.entries(users).forEach(([uid, user]) => {
            // Protect admins - they can only be demoted by another admin
            const isProtectedAdmin = user.role === 'admin' && currentUserData?.role !== 'admin';
            const isSelf = uid === currentUser?.uid;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.email || 'N/A'}</td>
                <td>${user.displayName || 'N/A'}</td>
                <td>
                    <select class="role-select" data-uid="${uid}" ${isSelf ? 'disabled' : ''}>
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>${t('user')}</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>${t('admin')}</option>
                    </select>
                </td>
                <td>
                    ${!isSelf ? `<button class="btn-small btn-danger" onclick="deleteUser('${uid}')">${t('delete')}</button>` : `<span class="text-muted">${t('protected')}</span>`}
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Add role change listeners
        tbody.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const uid = e.target.dataset.uid;
                const newRole = e.target.value;
                try {
                    await firebase.database().ref(`users/${uid}/role`).set(newRole);
                    showToast(t('roleUpdated'), 'success');
                } catch (err) {
                    showToast(t('error'), 'error');
                    e.target.value = e.target.value === 'admin' ? 'user' : 'admin';
                }
            });
        });
    } catch (e) {
        console.error('Error loading users:', e);
        showToast(t('error'), 'error');
    }
}

async function loadAdminProfiles() {
    try {
        const snapshot = await firebase.database().ref('profiles').once('value');
        const profiles = snapshot.val() || {};
        
        const tbody = document.getElementById('profilesTableBody');
        tbody.innerHTML = '';
        
        Object.entries(profiles).forEach(([name, profile]) => {
            const visibility = profile.visibility || 'public';
            const ownerDisplay = profile.ownerName || profile.ownerEmail || 'Unassigned';
            
            const row = document.createElement('tr');
            row.id = `profile-row-${name}`;
            row.innerHTML = `
                <td>${profile.name || name}</td>
                <td>
                    <span class="owner-display">${ownerDisplay}</span>
                </td>
                <td>
                    <select class="visibility-select" data-profile="${name}" disabled style="opacity: 0.6;">
                        <option value="public" ${visibility === 'public' ? 'selected' : ''}>${t('public')}</option>
                        <option value="private" ${visibility === 'private' ? 'selected' : ''}>${t('private')}</option>
                    </select>
                </td>
                <td style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <button class="btn-small btn-edit" data-profile="${name}" 
                            style="background: #e5a00d; color: white;">
                        ✏️ Edit
                    </button>
                    <button class="btn-small btn-save" data-profile="${name}" 
                            style="background: #2ea043; color: white; display: none;">
                        💾 Save
                    </button>
                    <button class="btn-small btn-cancel" data-profile="${name}" 
                            style="background: #6c757d; color: white; display: none;">
                        ✕
                    </button>
                    <button class="btn-small btn-danger btn-delete" data-profile="${name}">
                        🗑️
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Add edit button listeners
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileName = e.target.dataset.profile;
                enableProfileEditing(profileName);
            });
        });
        
        // Add save button listeners
        tbody.querySelectorAll('.btn-save').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const profileName = e.target.dataset.profile;
                await saveProfileChanges(profileName);
            });
        });
        
        // Add cancel button listeners
        tbody.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileName = e.target.dataset.profile;
                cancelProfileEditing(profileName);
                loadAdminProfiles(); // Refresh to restore original values
            });
        });
        
        // Add delete button listeners  
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileName = e.target.dataset.profile;
                deleteProfileAdmin(profileName);
            });
        });
        
    } catch (e) {
        console.error('Error loading profiles:', e);
        showToast(t('error'), 'error');
    }
}

function enableProfileEditing(profileName) {
    const row = document.getElementById(`profile-row-${profileName}`);
    if (!row) return;
    
    // Enable visibility select
    const visSelect = row.querySelector('.visibility-select');
    if (visSelect) {
        visSelect.disabled = false;
        visSelect.style.opacity = '1';
    }
    
    // Add owner edit input
    const ownerCell = row.querySelector('td:nth-child(2)');
    const currentOwner = ownerCell.querySelector('.owner-display').textContent;
    ownerCell.innerHTML = `
        <input type="text" class="owner-input" value="" placeholder="${currentOwner}" 
               style="padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-tertiary); color: var(--text-primary); width: 100%;">
        <small style="font-size: 10px; color: var(--text-secondary);">Enter new owner email/username or leave empty</small>
    `;
    
    // Show save/cancel, hide edit
    row.querySelector('.btn-edit').style.display = 'none';
    row.querySelector('.btn-save').style.display = 'inline-block';
    row.querySelector('.btn-cancel').style.display = 'inline-block';
}

function cancelProfileEditing(profileName) {
    // Just reload the table
    loadAdminProfiles();
}

async function saveProfileChanges(profileName) {
    const row = document.getElementById(`profile-row-${profileName}`);
    if (!row) return;
    
    const visSelect = row.querySelector('.visibility-select');
    const ownerInput = row.querySelector('.owner-input');
    
    const newVisibility = visSelect.value;
    const newOwnerSearch = ownerInput ? ownerInput.value.trim() : '';
    
    // Show confirmation
    let confirmMsg = `⚠️ You are about to save changes to profile "${profileName}":\n\n`;
    confirmMsg += `• Visibility: ${newVisibility}\n`;
    if (newOwnerSearch) {
        confirmMsg += `• New owner: ${newOwnerSearch}\n`;
    }
    confirmMsg += `\nAre you sure you want to apply these changes?`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        // Update visibility
        await firebase.database().ref(`profiles/${profileName}/visibility`).set(newVisibility);
        
        // Update owner if specified
        if (newOwnerSearch) {
            // Find user
            const usersSnap = await firebase.database().ref('users').once('value');
            const users = usersSnap.val() || {};
            
            let foundUid = null;
            let foundUser = null;
            
            for (const [uid, user] of Object.entries(users)) {
                if (user.email === newOwnerSearch || user.displayName === newOwnerSearch) {
                    foundUid = uid;
                    foundUser = user;
                    break;
                }
            }
            
            if (!foundUid) {
                showToast(t('userNotFound'), 'error');
                return;
            }
            
            await firebase.database().ref(`profiles/${profileName}`).update({
                ownerUid: foundUid,
                ownerEmail: foundUser.email,
                ownerName: foundUser.displayName
            });
        }
        
        showToast('Changes saved successfully', 'success');
        loadAdminProfiles();
        
    } catch (e) {
        console.error('Error saving profile:', e);
        showToast(t('error'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT OWNER MODAL (Admin only - with confirmation)
// ═══════════════════════════════════════════════════════════════════════════════
function showEditOwnerModal(profileName) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'editOwnerModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>${t('editOwner')}: ${profileName}</h2>
                <button class="modal-close" onclick="closeEditOwnerModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="setting-group">
                    <label>${t('enterEmailOrUsername')}</label>
                    <input type="text" id="newOwnerInput" placeholder="email@example.com or username">
                </div>
                <div class="setting-group" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="confirmEditOwner('${profileName}')" style="width: 100%;">${t('assignOwner')}</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEditOwnerModal();
    });
}

function closeEditOwnerModal() {
    const modal = document.getElementById('editOwnerModal');
    if (modal) modal.remove();
}

async function confirmEditOwner(profileName) {
    const input = document.getElementById('newOwnerInput').value.trim();
    
    if (!input) {
        showToast(t('enterEmailOrUsername'), 'error');
        return;
    }
    
    if (!confirm(t('confirmEditOwner'))) {
        return;
    }
    
    try {
        // Find user by email or displayName
        const usersSnap = await firebase.database().ref('users').once('value');
        const users = usersSnap.val() || {};
        
        let foundUid = null;
        let foundUser = null;
        
        for (const [uid, user] of Object.entries(users)) {
            if (user.email === input || user.displayName === input) {
                foundUid = uid;
                foundUser = user;
                break;
            }
        }
        
        if (!foundUid) {
            showToast(t('userNotFound'), 'error');
            return;
        }
        
        // Update owner
        await firebase.database().ref(`profiles/${profileName}`).update({
            ownerUid: foundUid,
            ownerEmail: foundUser.email,
            ownerName: foundUser.displayName
        });
        
        showToast(t('ownerUpdated'), 'success');
        closeEditOwnerModal();
        loadAdminProfiles();
        
    } catch (e) {
        console.error('Error updating owner:', e);
        showToast(t('error'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARE PROFILE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
async function openShareProfileModal(profileName) {
    const profile = await firebase.database().ref(`profiles/${profileName}`).once('value');
    const profileData = profile.val() || {};
    const sharedWith = profileData.sharedWith || {};
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'shareProfileModal';
    
    let sharedListHtml = '';
    for (const [uid, access] of Object.entries(sharedWith)) {
        const userSnap = await firebase.database().ref(`users/${uid}`).once('value');
        const user = userSnap.val();
        if (user) {
            sharedListHtml += `
                <div class="share-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 6px;">
                    <span>${user.displayName || user.email}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <select class="access-select" data-uid="${uid}" style="padding: 4px;">
                            <option value="view" ${access === 'view' ? 'selected' : ''}>${t('viewOnly')}</option>
                            <option value="edit" ${access === 'edit' ? 'selected' : ''}>${t('canEdit')}</option>
                        </select>
                        <button class="btn-small btn-danger" onclick="removeShareAccess('${profileName}', '${uid}')">×</button>
                    </div>
                </div>
            `;
        }
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>${t('share')}: ${profileData.name || profileName}</h2>
                <button class="modal-close" onclick="closeShareProfileModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="setting-group">
                    <label>${t('inviteUser')}</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="shareEmailInput" placeholder="${t('enterEmailOrUsername')}" style="flex: 1;">
                        <select id="shareAccessType" style="width: 100px;">
                            <option value="view">${t('viewOnly')}</option>
                            <option value="edit">${t('canEdit')}</option>
                        </select>
                        <button class="btn btn-primary" onclick="sendShareInvite('${profileName}')">${t('invite')}</button>
                    </div>
                </div>
                
                <div class="setting-group" style="margin-top: 20px;">
                    <label>${t('sharedWith')}</label>
                    <div id="sharedWithList">
                        ${sharedListHtml || `<p style="color: var(--text-secondary); font-size: 0.85rem;">${t('noAccess')}</p>`}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add access change listeners
    modal.querySelectorAll('.access-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const uid = e.target.dataset.uid;
            const newAccess = e.target.value;
            try {
                await firebase.database().ref(`profiles/${profileName}/sharedWith/${uid}`).set(newAccess);
                showToast(t('visibilityUpdated'), 'success');
            } catch (err) {
                showToast(t('error'), 'error');
            }
        });
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeShareProfileModal();
    });
}

function closeShareProfileModal() {
    const modal = document.getElementById('shareProfileModal');
    if (modal) modal.remove();
}

async function sendShareInvite(profileName) {
    const input = document.getElementById('shareEmailInput').value.trim();
    const accessType = document.getElementById('shareAccessType').value;
    
    if (!input) {
        showToast(t('enterEmailOrUsername'), 'error');
        return;
    }
    
    try {
        // Find user by email or displayName
        const usersSnap = await firebase.database().ref('users').once('value');
        const users = usersSnap.val() || {};
        
        let foundUid = null;
        let foundUser = null;
        
        for (const [uid, user] of Object.entries(users)) {
            if (user.email === input || user.displayName === input) {
                foundUid = uid;
                foundUser = user;
                break;
            }
        }
        
        if (!foundUid) {
            showToast(t('userNotFound'), 'error');
            return;
        }
        
        // Add to sharedWith
        await firebase.database().ref(`profiles/${profileName}/sharedWith/${foundUid}`).set(accessType);
        
        showToast(`${t('invitationSent')} ${foundUser.displayName || foundUser.email}`, 'success');
        
        // Refresh the modal
        closeShareProfileModal();
        openShareProfileModal(profileName);
        
    } catch (e) {
        console.error('Error sending invite:', e);
        showToast(t('error'), 'error');
    }
}

async function removeShareAccess(profileName, uid) {
    try {
        await firebase.database().ref(`profiles/${profileName}/sharedWith/${uid}`).remove();
        showToast(t('accessRemoved'), 'success');
        closeShareProfileModal();
        openShareProfileModal(profileName);
    } catch (e) {
        showToast(t('error'), 'error');
    }
}

async function deleteUser(uid) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        await firebase.database().ref(`users/${uid}`).remove();
        showToast(t('userDeleted'), 'success');
        loadAdminUsers();
    } catch (e) {
        showToast(t('error'), 'error');
    }
}

async function deleteProfileAdmin(name) {
    if (!confirm(`Are you sure you want to delete profile "${name}"?`)) return;
    
    try {
        await firebase.database().ref(`profiles/${name}`).remove();
        showToast(t('profileDeleted'), 'success');
        loadAdminProfiles();
        // Reload profiles in main app
        if (typeof loadProfiles === 'function') {
            loadProfiles();
        }
    } catch (e) {
        showToast(t('error'), 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER - Check if user can access profile (VIEW)
// ═══════════════════════════════════════════════════════════════════════════════
function canAccessProfile(profile, profileId) {
    // Admin can see all
    if (currentUserData && currentUserData.role === 'admin') {
        return true;
    }
    
    // Public profiles are visible to all
    if (!profile.visibility || profile.visibility === 'public') {
        return true;
    }
    
    // Not logged in? Can only see public
    if (!currentUser) {
        return false;
    }
    
    // Owner can always access
    if (profile.ownerUid === currentUser.uid) {
        return true;
    }
    
    // Check if shared with user
    if (profile.sharedWith && profile.sharedWith[currentUser.uid]) {
        return true;
    }
    
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER - Check if user can EDIT profile
// ═══════════════════════════════════════════════════════════════════════════════
function canEditProfile(profile, profileId) {
    // Admin can edit all
    if (currentUserData && currentUserData.role === 'admin') {
        return true;
    }
    
    // Not logged in? Cannot edit
    if (!currentUser) {
        return false;
    }
    
    // Owner can always edit
    if (profile.ownerUid === currentUser.uid) {
        return true;
    }
    
    // Check if shared with edit permission
    if (profile.sharedWith && profile.sharedWith[currentUser.uid] === 'edit') {
        return true;
    }
    
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER - Check if user is admin
// ═══════════════════════════════════════════════════════════════════════════════
function isUserAdmin() {
    return currentUserData && currentUserData.role === 'admin';
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER - Check if user OWNS the profile (not just can edit)
// ═══════════════════════════════════════════════════════════════════════════════
function isProfileOwner(profile, profileId) {
    // Not logged in? Cannot own
    if (!currentUser) {
        return false;
    }
    
    // Check if user is the owner
    return profile.ownerUid === currentUser.uid;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CMD AUTHENTICATION LINKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a token for CMD authentication
 * Format: uid:email:role:expires (base64 encoded)
 * Token valid for 24 hours
 */
function generateCmdToken() {
    if (!currentUser) {
        showToast('You must be logged in to generate a token', 'error');
        return null;
    }
    
    const role = currentUserData?.role || 'user';
    const expires = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    const tokenData = `${currentUser.uid}:${currentUser.email}:${role}:${expires}`;
    const token = btoa(tokenData); // Base64 encode
    
    return token;
}

/**
 * Show the CMD link modal
 */
function showCmdLinkModal() {
    if (!currentUser) {
        showToast(t('notLoggedIn') || 'Please log in first', 'error');
        return;
    }
    
    const token = generateCmdToken();
    if (!token) return;
    
    const role = currentUserData?.role || 'user';
    const roleBadge = role === 'admin' ? '👑 ADMIN' : '👤 USER';
    
    const modalHtml = `
        <div id="cmdLinkModal" class="modal active" onclick="if(event.target === this) closeCmdLinkModal()">
            <div class="modal-content" style="max-width: 500px;">
                <span class="close" onclick="closeCmdLinkModal()">&times;</span>
                <h3>🔗 Link CMD Session</h3>
                
                <div style="margin: 20px 0;">
                    <p><strong>User:</strong> ${currentUser.email}</p>
                    <p><strong>Role:</strong> ${roleBadge}</p>
                </div>
                
                <div style="background: var(--primary-bg); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin-bottom: 10px;"><strong>Option 1: Copy Token</strong></p>
                    <p style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 10px;">
                        Copy this token and paste it in the CMD menu option "Link manually"
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="cmdTokenInput" value="${token}" readonly 
                               style="flex: 1; font-family: monospace; font-size: 0.85em;">
                        <button onclick="copyCmdToken()" class="btn btn-primary">📋 Copy</button>
                    </div>
                </div>
                
                <div style="background: var(--primary-bg); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin-bottom: 10px;"><strong>Option 2: Enter Code</strong></p>
                    <p style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 10px;">
                        If the CMD shows a code, enter it below to link automatically
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <input type="text" id="cmdAuthCode" placeholder="Enter code from CMD..." 
                               style="flex: 1; font-family: monospace;">
                        <button onclick="confirmCmdAuthCode()" class="btn btn-success">✓ Link</button>
                    </div>
                </div>
                
                <div style="margin-top: 20px; padding: 10px; background: #fff3cd; border-radius: 4px; color: #856404;">
                    ⚠️ Token expires in 24 hours. Keep it secure!
                </div>
                
                <div style="margin-top: 20px; text-align: right;">
                    <button onclick="closeCmdLinkModal()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existing = document.getElementById('cmdLinkModal');
    if (existing) existing.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeCmdLinkModal() {
    const modal = document.getElementById('cmdLinkModal');
    if (modal) modal.remove();
}

function copyCmdToken() {
    const input = document.getElementById('cmdTokenInput');
    if (input) {
        input.select();
        document.execCommand('copy');
        showToast('Token copied to clipboard!', 'success');
    }
}

/**
 * Confirm CMD auth code
 * This saves the auth data to Firebase so CMD can retrieve it
 */
async function confirmCmdAuthCode() {
    const codeInput = document.getElementById('cmdAuthCode');
    const code = codeInput?.value?.trim();
    
    if (!code) {
        showToast('Please enter the code from CMD', 'error');
        return;
    }
    
    if (!currentUser) {
        showToast('You must be logged in', 'error');
        return;
    }
    
    try {
        // Save auth data to Firebase under the code
        const db = firebase.database();
        const role = currentUserData?.role || 'user';
        const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        await db.ref(`cmd_auth/${code}`).set({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUserData?.displayName || currentUser.email,
            role: role,
            tokenExpires: expires,
            linkedAt: new Date().toISOString(),
            linkedBy: currentUser.uid
        });
        
        showToast('✓ CMD session linked successfully!', 'success');
        closeCmdLinkModal();
        
        // Auto-delete after 5 minutes (code already used)
        setTimeout(async () => {
            try {
                await db.ref(`cmd_auth/${code}`).remove();
            } catch (e) {
                // Ignore
            }
        }, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('Error linking CMD:', error);
        showToast('Error linking CMD session: ' + error.message, 'error');
    }
}

// Export for use in app.js
window.canAccessProfile = canAccessProfile;
window.canEditProfile = canEditProfile;
window.isProfileOwner = isProfileOwner;
window.getCurrentUser = () => currentUser;
window.getCurrentUserData = () => currentUserData;
window.isAdmin = () => currentUserData && currentUserData.role === 'admin';
window.isLoggedIn = () => currentUser !== null;
window.t = t;
window.setLanguage = setLanguage;
window.currentLanguage = () => currentLanguage;
window.isUserAdmin = isUserAdmin;

// Make functions global for onclick handlers
window.closeUserSettingsModal = closeUserSettingsModal;
window.saveUserSettings = saveUserSettings;
window.deleteUser = deleteUser;
window.deleteProfileAdmin = deleteProfileAdmin;
window.openShareProfileModal = openShareProfileModal;
window.closeShareProfileModal = closeShareProfileModal;
window.sendShareInvite = sendShareInvite;
window.removeShareAccess = removeShareAccess;
window.showEditOwnerModal = showEditOwnerModal;
window.closeEditOwnerModal = closeEditOwnerModal;
window.confirmEditOwner = confirmEditOwner;
window.showCmdLinkModal = showCmdLinkModal;
window.closeCmdLinkModal = closeCmdLinkModal;
window.copyCmdToken = copyCmdToken;
window.confirmCmdAuthCode = confirmCmdAuthCode;
window.generateCmdToken = generateCmdToken;

// Initialize auth after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    setTimeout(initAuth, 150);
});
