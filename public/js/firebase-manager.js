/**
 * MuNRa 4.0 - Firebase Manager
 * 
 * Owns the Firebase app lifecycle: initialise, re-initialise (when the
 * user switches databases), and expose the live `db` reference.
 * 
 * Depends on: config.js (FIREBASE_CONFIG, DEFAULT_FIREBASE_URL)
 */

const FirebaseManager = (() => {
    /** @type {firebase.database.Database|null} */
    let _db = null;

    /**
     * Initialise (or re-initialise) the Firebase app.
     *
     * @param {string} [url] - Custom Realtime Database URL.
     *                          Falls back to localStorage, then DEFAULT_FIREBASE_URL.
     * @returns {Promise<firebase.database.Database>}
     */
    async function init(url) {
        const databaseURL =
            url ||
            localStorage.getItem('munra_firebase_url') ||
            DEFAULT_FIREBASE_URL;

        const config = { ...FIREBASE_CONFIG, databaseURL };

        try {
            // If an app already exists, delete it first (user switched DB)
            if (firebase.apps.length > 0) {
                await firebase.app().delete();
            }
            firebase.initializeApp(config);
            _db = firebase.database();
            return _db;
        } catch (err) {
            console.error('[FirebaseManager] init error:', err);
            UIManager.setConnectionStatus('error', 'Connection failed');
            throw err;
        }
    }

    /** @returns {firebase.database.Database|null} */
    function getDb() {
        return _db;
    }

    return Object.freeze({ init, getDb });
})();
