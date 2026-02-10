/**
 * MuNRa 4.5.2 - Dual-Mode Serial Data Reader
 * 
 * Reads data from particle detector via USB serial port.
 * Supports TWO connection modes for universal browser compatibility:
 * 
 * MODE 1 — Web Serial API (direct, Chrome/Edge/Opera only):
 *   Browser talks directly to the USB serial port.
 *   Requires Chrome 89+, Edge 89+, or Opera 75+.
 * 
 * MODE 2 — WebSocket Bridge (ANY browser, including Firefox/Safari):
 *   A small Python script (tools/serial_bridge.py) runs on the user's
 *   machine, reads the serial port, and forwards data over WebSocket.
 *   The browser connects to ws://localhost:8765.
 *   Works with EVERY browser that supports WebSocket (all modern browsers).
 * 
 * The UI automatically detects which modes are available and lets the
 * user choose. Buttons are NEVER disabled — there is always a way to connect.
 * 
 * SERIAL COMPATIBILITY:
 *   - Chrome/Edge/Opera: Web Serial API (direct USB) or WebSocket Bridge
 *   - Firefox/Safari/any: WebSocket Bridge
 *   - Linux: user must be in 'dialout' group for /dev/ttyACM0 access
 *   - Provides detailed OS-specific error diagnostics on connection failure
 * 
 * SCIENTIFIC INTEGRITY: Data is NEVER filtered, edited, or discarded.
 * All measurements are saved exactly as received from the detector.
 * 
 * Primary data format (TAB/space-separated from MuNRa detector):
 *   Event TimeStamp[ms] ADC1 ADC2 SiPM[mV] Pressure[Pa] Temp[C] DeadTime[us] Coincident COSMIC
 *   Example: "270 111753 60 1881 0.9 76501.6 27.1 46100 0 COSMIC"
 */

// Serial connection state
let serialPort = null;
let serialReader = null;
let serialWriter = null;
let isSerialConnected = false;
let isRecording = false;
let recordingProfile = null;
let recordingSession = null;
let _firstMinuteIsPartial = false;

// Data aggregation state
let currentMinute = null;
let minuteData = {
    eventCount: 0,
    coincidentCount: 0,
    sipmSum: 0,
    sipmMin: Infinity,
    sipmMax: -Infinity,
    tempSum: 0,
    tempCount: 0,
    pressureSum: 0,
    pressureCount: 0,
    deadtimeSum: 0,
    deadtimeCount: 0
};

// WebSocket bridge state (for Firefox/Safari/any browser)
let _wsBridge = null;         // WebSocket connection to bridge server
let _wsConnected = false;     // Whether bridge WebSocket is open
let _connectionMode = null;   // 'serial' | 'websocket' | null
const WS_BRIDGE_URL = 'ws://localhost:8765';

// Terminal output element
let terminalOutput = null;

// ─── Platform & Browser Detection ─────────────────────────────────
/**
 * Detect user's operating system.
 * Returns 'linux', 'macos', 'windows', 'chromeos', or 'unknown'.
 */
function detectOS() {
    const ua = navigator.userAgent || '';
    const plat = navigator.platform || '';
    // Order matters: ChromeOS ua contains 'Linux' too, check first
    if (/CrOS/.test(ua))                        return 'chromeos';
    if (/Linux/.test(plat) || /Linux/.test(ua))  return 'linux';
    if (/Mac/.test(plat) || /Mac/.test(ua))      return 'macos';
    if (/Win/.test(plat) || /Win/.test(ua))      return 'windows';
    return 'unknown';
}

/**
 * Detect browser name and version.
 * Returns { name: string, version: string, serialCapable: boolean }
 */
function detectBrowser() {
    const ua = navigator.userAgent || '';
    let name = 'Unknown', version = '';

    // Order matters — Edge/Opera contain 'Chrome' in UA too
    if (/Edg\/(\d[\d.]*)/.test(ua))       { name = 'Edge';    version = RegExp.$1; }
    else if (/OPR\/(\d[\d.]*)/.test(ua))   { name = 'Opera';   version = RegExp.$1; }
    else if (/Chrome\/(\d[\d.]*)/.test(ua)) { name = 'Chrome';  version = RegExp.$1; }
    else if (/Firefox\/(\d[\d.]*)/.test(ua)){ name = 'Firefox'; version = RegExp.$1; }
    else if (/Safari\/(\d[\d.]*)/.test(ua)) { name = 'Safari';  version = RegExp.$1; }

    const serialCapable = ('serial' in navigator);
    return { name, version, serialCapable };
}

/**
 * Check if Web Serial API is available
 */
function isSerialSupported() {
    return 'serial' in navigator;
}

/**
 * Get a user-friendly browser compatibility message with download links.
 * Returns { supported: boolean, message: string, help: string }
 */
function getSerialCompatInfo() {
    const browser = detectBrowser();
    if (browser.serialCapable) {
        return { supported: true, message: `${browser.name} ${browser.version} — Web Serial supported`, help: '' };
    }

    const os = detectOS();
    let downloadHint = '';
    switch (os) {
        case 'linux':
            downloadHint = 'Install Google Chrome: https://www.google.com/chrome/ or run:\n  sudo apt install google-chrome-stable  (Debian/Ubuntu)\n  sudo dnf install google-chrome-stable   (Fedora)';
            break;
        case 'macos':
            downloadHint = 'Install Google Chrome: https://www.google.com/chrome/ or:\n  brew install --cask google-chrome';
            break;
        case 'windows':
            downloadHint = 'Install Google Chrome: https://www.google.com/chrome/\nor Microsoft Edge (already installed on Windows 10+)';
            break;
        default:
            downloadHint = 'Install Google Chrome: https://www.google.com/chrome/';
    }

    return {
        supported: false,
        message: `${browser.name} does not support direct USB connection (Web Serial API).`,
        help: downloadHint,
        bridgeAvailable: true,
        bridgeMessage: 'Use the WebSocket Bridge to connect from any browser.\nRun the bridge script on your computer, then click Connect.'
    };
}

/**
 * Build a detailed, actionable error message from a serial port open() failure.
 * Parses the raw error and adds OS-specific troubleshooting steps.
 */
function _buildSerialErrorDiagnostic(error) {
    const msg = (error.message || '').toLowerCase();
    const os = detectOS();
    const lines = [];

    // ── 1. Permission denied ──────────────────────────────────────
    if (msg.includes('permission') || msg.includes('access denied') || msg.includes('failed to open serial port')) {
        lines.push('SERIAL PORT PERMISSION ERROR');
        lines.push('The browser cannot access the serial device.\n');

        if (os === 'linux') {
            lines.push('On Linux, serial devices (e.g. /dev/ttyACM0) require');
            lines.push('your user to be in the "dialout" group.\n');
            lines.push('FIX (run in a terminal, then LOG OUT and back in):');
            lines.push('  sudo usermod -a -G dialout $USER\n');
            lines.push('Quick test (temporary, resets on reboot):');
            lines.push('  sudo chmod 666 /dev/ttyACM0\n');
            lines.push('Verify your groups:');
            lines.push('  groups $USER');
            lines.push('You should see "dialout" in the output.\n');
            lines.push('NOTE: If the device is /dev/ttyUSB0 instead of');
            lines.push('/dev/ttyACM0, the same fix applies.');
        } else if (os === 'macos') {
            lines.push('On macOS, serial permissions are usually automatic.');
            lines.push('If this error persists:');
            lines.push('  1. Check System Preferences > Security & Privacy');
            lines.push('  2. Ensure Chrome has USB access');
            lines.push('  3. Try unplugging and reconnecting the USB cable');
        } else if (os === 'windows') {
            lines.push('On Windows, you may need to install the USB driver:');
            lines.push('  1. Open Device Manager');
            lines.push('  2. Look for "Ports (COM & LPT)" or unknown devices');
            lines.push('  3. Install the Arduino/CH340/FTDI driver if needed');
            lines.push('  4. Note the COM port number (e.g. COM3)');
        } else {
            lines.push('Ensure your user has permission to access serial/USB devices.');
        }

        // Check if port might be busy (common sub-case of permission errors)
        lines.push('\nAlso check: Is another program using the port?');
        lines.push('Close minicom, Arduino IDE, PuTTY, screen, or any');
        lines.push('other serial monitor before connecting.');

        return lines.join('\n');
    }

    // ── 2. Port busy / already in use ─────────────────────────────
    if (msg.includes('busy') || msg.includes('in use') || msg.includes('locked') || msg.includes('resource')) {
        lines.push('SERIAL PORT IS BUSY');
        lines.push('Another application is already using this port.\n');
        lines.push('Common culprits:');
        lines.push('  - minicom / screen / picocom');
        lines.push('  - Arduino IDE Serial Monitor');
        lines.push('  - Another browser tab with MuNRa');
        lines.push('  - PuTTY or other serial terminal\n');
        if (os === 'linux') {
            lines.push('Find what is using the port:');
            lines.push('  sudo fuser /dev/ttyACM0');
            lines.push('  sudo lsof /dev/ttyACM0');
            lines.push('\nKill the process if needed:');
            lines.push('  sudo fuser -k /dev/ttyACM0');
        }
        return lines.join('\n');
    }

    // ── 3. Device not found / disconnected ────────────────────────
    if (msg.includes('not found') || msg.includes('no such') || msg.includes('device') || msg.includes('disconnected')) {
        lines.push('SERIAL DEVICE NOT FOUND');
        lines.push('The detector does not appear to be connected.\n');
        lines.push('Troubleshooting:');
        lines.push('  1. Check the USB cable is firmly connected');
        lines.push('  2. Try a different USB port');
        lines.push('  3. Try a different USB cable');
        if (os === 'linux') {
            lines.push('  4. Check if the device appears:');
            lines.push('       ls -la /dev/ttyACM* /dev/ttyUSB*');
            lines.push('  5. Check kernel messages:');
            lines.push('       dmesg | tail -20');
        } else if (os === 'windows') {
            lines.push('  4. Open Device Manager → Ports (COM & LPT)');
            lines.push('  5. Check if a COM port appears when you plug in the detector');
        } else if (os === 'macos') {
            lines.push('  4. Check:  ls /dev/tty.usb*');
        }
        return lines.join('\n');
    }

    // ── 4. User cancelled the port picker dialog ──────────────────
    if (msg.includes('cancel') || msg.includes('no port selected') || error.name === 'NotFoundError') {
        // Not really an error — user just cancelled. Keep it brief.
        return 'No serial port was selected. Click "Connect" again to choose a port.';
    }

    // ── 5. Network error (e.g. sandboxed context) ─────────────────
    if (msg.includes('network') || msg.includes('security') || msg.includes('sandbox')) {
        lines.push('SECURITY RESTRICTION');
        lines.push('The Web Serial API requires a secure context (HTTPS or localhost).');
        lines.push('If running locally, use: http://localhost or https://');
        return lines.join('\n');
    }

    // ── 6. Generic / unrecognized error ───────────────────────────
    lines.push(`SERIAL CONNECTION ERROR: ${error.message || error}`);
    lines.push('');
    if (os === 'linux') {
        lines.push('Common Linux fixes:');
        lines.push('  sudo usermod -a -G dialout $USER  (then log out/in)');
        lines.push('  sudo chmod 666 /dev/ttyACM0       (temporary)');
        lines.push('  Close any serial monitors (minicom, Arduino IDE, screen)');
    }
    lines.push('\nIf the problem persists, check the browser console (F12)');
    lines.push('for more details and report the error.');
    return lines.join('\n');
}

/**
 * Request and open a serial port connection.
 * Strategy:
 *   1. If Web Serial API is available → use it (Chrome/Edge/Opera)
 *   2. If not → automatically try WebSocket bridge (any browser)
 * Provides detailed, OS-specific error diagnostics on failure.
 */
async function connectSerialPort() {
    // If Web Serial API not available, go straight to WebSocket bridge
    if (!isSerialSupported()) {
        return connectWebSocketBridge();
    }

    // ── Web Serial path (Chrome/Edge/Opera) ───────────────────────

    // ── Step 1: Request port from user (browser picker dialog) ────
    try {
        serialPort = await navigator.serial.requestPort();
    } catch (pickError) {
        // User cancelled the dialog, or no ports available
        if (pickError.name === 'NotFoundError' || (pickError.message || '').toLowerCase().includes('cancel')) {
            throw new Error('No serial port was selected.\nClick "Connect" again and choose your detector from the list.\n\nIf no ports appear in the list:\n  - Check that the detector is plugged in via USB\n  - Try a different USB cable or port');
        }
        throw new Error(_buildSerialErrorDiagnostic(pickError));
    }

    // ── Step 2: Open the port ─────────────────────────────────────
    try {
        await serialPort.open({
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
    } catch (openError) {
        // Port selected but open() failed — this is the common Linux permissions issue
        console.error('Serial port open() failed:', openError);
        serialPort = null;
        throw new Error(_buildSerialErrorDiagnostic(openError));
    }

    _connectionMode = 'serial';
    isSerialConnected = true;
    console.log('Serial port connected at 9600 baud (Web Serial API)');

    return true;
}

/**
 * Connect via WebSocket bridge (for ANY browser including Firefox/Safari).
 * The bridge is a Python script that reads serial and forwards via WebSocket.
 * Connects to ws://localhost:8765
 */
async function connectWebSocketBridge() {
    if (_wsBridge && _wsBridge.readyState === WebSocket.OPEN) {
        throw new Error('WebSocket bridge is already connected.');
    }

    appendToTerminal('[System] Connecting to WebSocket bridge at ' + WS_BRIDGE_URL + '...');

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (_wsBridge) { try { _wsBridge.close(); } catch(e) {} }
            _wsBridge = null;
            const os = detectOS();
            const lines = [
                'WEBSOCKET BRIDGE NOT RUNNING',
                '',
                'The bridge script must be running on your computer to connect.',
                '',
                'Quick start:',
                '  1. Install dependencies (one time):',
                '     pip3 install pyserial websockets',
                '',
                '  2. Download and run the bridge:',
            ];
            if (os === 'linux' || os === 'macos') {
                lines.push('     python3 tools/serial_bridge.py');
            } else {
                lines.push('     python tools\\serial_bridge.py');
            }
            lines.push('');
            lines.push('  3. Then click "Connect" in the browser again.');
            lines.push('');
            lines.push('The bridge script is included with MuNRa:');
            lines.push('  tools/serial_bridge.py');
            lines.push('');
            lines.push('Download it from the MuNRa website if needed:');
            lines.push(`  ${window.location.origin}/tools/serial_bridge.py`);
            reject(new Error(lines.join('\n')));
        }, 3000);  // 3 second timeout

        try {
            _wsBridge = new WebSocket(WS_BRIDGE_URL);
        } catch (e) {
            clearTimeout(timeout);
            reject(new Error('Could not create WebSocket connection.\nMake sure the bridge script is running.'));
            return;
        }

        _wsBridge.onopen = () => {
            clearTimeout(timeout);
            _wsConnected = true;
            _connectionMode = 'websocket';
            isSerialConnected = true;
            console.log('Connected to WebSocket bridge at ' + WS_BRIDGE_URL);
            resolve(true);
        };

        _wsBridge.onerror = (event) => {
            clearTimeout(timeout);
            console.error('WebSocket bridge error:', event);
            // The error event fires but has no useful info — the timeout handles the message
        };

        _wsBridge.onclose = () => {
            _wsConnected = false;
            if (_connectionMode === 'websocket' && isSerialConnected) {
                isSerialConnected = false;
                appendToTerminal('[System] WebSocket bridge disconnected.');
                if (typeof UIManager !== 'undefined') {
                    UIManager.showToast('Bridge disconnected', 'error');
                }
            }
        };
    });
}

/**
 * Disconnect from the WebSocket bridge
 */
async function disconnectWebSocketBridge() {
    if (_wsBridge) {
        try { _wsBridge.close(); } catch (e) { /* ignore */ }
        _wsBridge = null;
    }
    _wsConnected = false;
    _connectionMode = null;
    isSerialConnected = false;
}

/**
 * Disconnect from serial port
 * If recording is active, saves partial data first
 */
async function disconnectSerialPort() {
    try {
        // If we're recording, stop cleanly first (saves partial minute data)
        if (isRecording) {
            await stopRecording();
        }

        // Disconnect based on connection mode
        if (_connectionMode === 'websocket') {
            await disconnectWebSocketBridge();
        } else {
            if (serialReader) {
                try { await serialReader.cancel(); } catch (e) { /* ignore */ }
                try { serialReader.releaseLock(); } catch (e) { /* ignore */ }
                serialReader = null;
            }
            
            if (serialPort) {
                try { await serialPort.close(); } catch (e) { /* ignore */ }
                serialPort = null;
            }
        }
        
        _connectionMode = null;
        isSerialConnected = false;
        isRecording = false;
        console.log('Disconnected');
        
        return true;
    } catch (error) {
        console.error('Disconnect error:', error);
        // Still try to clean up state
        _connectionMode = null;
        isSerialConnected = false;
        isRecording = false;
        serialReader = null;
        serialPort = null;
        _wsBridge = null;
        _wsConnected = false;
        throw error;
    }
}

/**
 * Start reading data from serial port and recording to Firebase
 * @param {string} profileId - The profile ID to record data to
 * @param {boolean} enableRealtime - Whether to store real-time data (expensive)
 */
async function startRecording(profileId, enableRealtime = false) {
    if (!isSerialConnected) {
        throw new Error('Not connected. Click "Connect" first.');
    }
    if (_connectionMode === 'serial' && !serialPort) {
        throw new Error('Serial port not connected');
    }
    if (_connectionMode === 'websocket' && (!_wsBridge || _wsBridge.readyState !== WebSocket.OPEN)) {
        throw new Error('WebSocket bridge not connected. Run the bridge script and reconnect.');
    }
    
    if (!profileId) {
        throw new Error('No profile selected');
    }
    
    recordingProfile = profileId;
    isRecording = true;
    _lastCleanupProfile = profileId;
    
    // Create new session
    const sessionId = `session_${Date.now()}`;
    recordingSession = sessionId;
    
    // Initialize session in Firebase
    const user = firebase.auth().currentUser;
    appendToTerminal(`[System] User: ${user ? user.email : 'NOT LOGGED IN'}`);
    appendToTerminal(`[System] Profile: ${profileId}`);
    appendToTerminal(`[System] Session: ${sessionId}`);
    appendToTerminal(`[System] Writing to: profiles/${profileId}/sessions/${sessionId}/`);
    
    try {
        await firebase.database().ref(`profiles/${profileId}/sessions/${sessionId}`).set({
            startTime: Date.now(),
            name: `Session ${new Date().toLocaleString()}`,
            status: 'recording'
        });
    } catch (error) {
        isRecording = false;
        recordingProfile = null;
        recordingSession = null;
        const errMsg = (error.message || '').toUpperCase();
        if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('PERMISSION DENIED')) {
            const user = firebase.auth().currentUser;
            let detail = 'DATABASE PERMISSION DENIED.\n';
            detail += 'This is NOT a serial port error — it is a Firebase database error.\n';
            if (!user) {
                detail += 'You are NOT LOGGED IN. Log in first, then try recording.\n';
            } else {
                detail += `Logged in as: ${user.email}\n`;
                detail += `This account may not have write access to profile "${profileId}".\n`;
            }
            detail += 'Check that you own this profile or have edit permissions.';
            throw new Error(detail);
        }
        throw error;
    }
    
    appendToTerminal('[OK] Session created in Firebase. Data will be saved every minute.');
    appendToTerminal(`[System] Current minute boundary: ${new Date(Math.floor(Date.now() / 60000) * 60000).toLocaleTimeString()}`);
    appendToTerminal(`[System] First save will happen at the next minute boundary.`);
    
    // Reset minute data and error counters
    resetMinuteData();
    currentMinute = Math.floor(Date.now() / 60000);
    _firstMinuteIsPartial = true;
    _latestWriteErrors = 0;
    _lastLatestUpdate = 0;
    
    // Start reading — different loop depending on connection mode
    if (_connectionMode === 'websocket') {
        readWebSocketLoop(enableRealtime);
    } else {
        readSerialLoop(enableRealtime);
    }
    
    console.log(`Recording started for profile: ${profileId}, session: ${sessionId}, mode: ${_connectionMode}`);
    return sessionId;
}

/**
 * Stop recording
 */
async function stopRecording() {
    const wasRecording = isRecording;
    isRecording = false;
    
    // Cancel the serial reader to unblock the read loop
    if (serialReader) {
        try { await serialReader.cancel(); } catch (e) { /* ignore */ }
    }
    
    // DISCARD partial minute data — only complete minutes are scientifically valid.
    // A partial minute would show artificially low event counts (e.g., 30 events
    // in 20 seconds looks like 30/min instead of ~90/min), misleading researchers.
    if (minuteData.eventCount > 0) {
        appendToTerminal(`[System] Discarding partial minute (${minuteData.eventCount} events in incomplete minute) — only complete minutes are saved.`);
        resetMinuteData();
    }
    
    // Update session status
    if (recordingProfile && recordingSession) {
        try {
            await firebase.database().ref(`profiles/${recordingProfile}/sessions/${recordingSession}`).update({
                endTime: Date.now(),
                status: 'completed'
            });
            appendToTerminal('[OK] Session marked as completed.');
        } catch (e) {
            appendToTerminal(`[Error] Could not update session status: ${e.message}`);
        }
    }
    
    // Reset recording state
    recordingProfile = null;
    recordingSession = null;
    _latestWriteErrors = 0;
    
    console.log('Recording stopped');
}

/**
 * Main serial reading loop
 * 
 * Uses getReader() on the raw readable stream + TextDecoder instead of pipeTo,
 * so the stream can be properly released when recording stops.
 */
async function readSerialLoop(enableRealtime) {
    if (!serialPort || !serialPort.readable) {
        appendToTerminal('[Error] Serial port not readable — cannot start read loop.');
        return;
    }

    // Use raw byte reader + TextDecoder instead of pipeTo/TextDecoderStream
    // pipeTo locks the readable stream permanently — getReader can be released
    const decoder = new TextDecoder();
    serialReader = serialPort.readable.getReader();
    
    let buffer = '';
    let linesProcessed = 0;
    let linesParsed = 0;
    let linesFailed = 0;
    let exitReason = 'unknown';
    
    appendToTerminal('[System] Serial read loop started. Waiting for data...');
    
    try {
        while (isRecording) {
            const { value, done } = await serialReader.read();
            
            if (done) {
                exitReason = 'stream ended (done=true)';
                break;
            }
            
            if (value) {
                // Decode raw bytes to text
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                let lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                // Detector sometimes omits \n between records:
                //   "...0 COSMIC488 1059953..." → two events glued together
                // Split any such concatenated lines on the COSMIC+digit boundary
                const expanded = [];
                for (const rawLine of lines) {
                    const subLines = rawLine.split(/(?<=COSMIC)(?=\d)/);
                    for (const sub of subLines) {
                        expanded.push(sub);
                    }
                }
                lines = expanded;
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        try {
                            linesProcessed++;
                            const wasParsed = processDataLine(trimmed, enableRealtime);
                            if (wasParsed) linesParsed++;
                            else linesFailed++;
                        } catch (lineError) {
                            linesFailed++;
                            console.error('Error processing line:', trimmed, lineError);
                            if (linesFailed <= 3) {
                                appendToTerminal(`[Error] Line processing crashed: ${lineError.message}`);
                            }
                        }
                    }
                }
                
                // Log progress periodically (every 100 lines)
                if (linesProcessed > 0 && linesProcessed % 100 === 0) {
                    appendToTerminal(`[System] Progress: ${linesProcessed} lines received, ${linesParsed} parsed OK, ${linesFailed} skipped`);
                }
            }
        }
        if (isRecording) exitReason = 'stream ended'; else exitReason = 'recording stopped';
    } catch (error) {
        exitReason = `error: ${error.message}`;
        if (error.name !== 'NetworkError' && error.message !== 'The device has been lost.') {
            console.error('Serial read error:', error);
            appendToTerminal(`[Error] Serial read loop error: ${error.message}`);
        }
    } finally {
        // ─── DISCARD partial minute data — only complete minutes are valid ───
        if (minuteData.eventCount > 0) {
            appendToTerminal(`[System] Discarding partial minute (${minuteData.eventCount} events) on loop exit — only complete minutes are saved.`);
            resetMinuteData();
        }
        
        appendToTerminal(`[System] Read loop ended: ${exitReason}. Total: ${linesProcessed} lines, ${linesParsed} parsed, ${linesFailed} skipped.`);
        console.log('Serial read loop ended:', exitReason);
        
        if (serialReader) {
            try { serialReader.releaseLock(); } catch (e) { /* ignore */ }
            serialReader = null;
        }
    }
}

/**
 * WebSocket bridge read loop.
 * Receives serial data forwarded by the Python bridge script.
 * Data arrives as JSON messages: { type: "serial_data", line: "...", ts: 12345 }
 * The data lines are then processed by the same processDataLine() as Web Serial.
 */
function readWebSocketLoop(enableRealtime) {
    if (!_wsBridge || _wsBridge.readyState !== WebSocket.OPEN) {
        appendToTerminal('[Error] WebSocket bridge not connected — cannot start read loop.');
        return;
    }

    let linesProcessed = 0;
    let linesParsed = 0;
    let linesFailed = 0;

    appendToTerminal('[System] WebSocket bridge read loop started. Waiting for data...');

    _wsBridge.onmessage = (event) => {
        if (!isRecording) return;

        try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'bridge_info') {
                appendToTerminal(`[OK] Bridge: ${msg.message} (port: ${msg.serial_port}, baud: ${msg.baud_rate})`);
                return;
            }

            if (msg.type === 'serial_data' && msg.line) {
                const line = msg.line.trim();
                if (!line) return;

                try {
                    linesProcessed++;
                    const wasParsed = processDataLine(line, enableRealtime);
                    if (wasParsed) linesParsed++;
                    else linesFailed++;
                } catch (lineError) {
                    linesFailed++;
                    console.error('Error processing bridge line:', line, lineError);
                    if (linesFailed <= 3) {
                        appendToTerminal(`[Error] Line processing error: ${lineError.message}`);
                    }
                }

                // Log progress periodically
                if (linesProcessed > 0 && linesProcessed % 100 === 0) {
                    appendToTerminal(`[System] Bridge progress: ${linesProcessed} lines, ${linesParsed} parsed, ${linesFailed} skipped`);
                }
            }
        } catch (parseError) {
            // Not JSON — try processing as raw line
            const raw = event.data.trim();
            if (raw) {
                linesProcessed++;
                try {
                    const wasParsed = processDataLine(raw, enableRealtime);
                    if (wasParsed) linesParsed++;
                    else linesFailed++;
                } catch (e) { linesFailed++; }
            }
        }
    };

    // Handle bridge disconnection during recording
    const origOnclose = _wsBridge.onclose;
    _wsBridge.onclose = () => {
        appendToTerminal(`[System] Bridge read loop ended. Total: ${linesProcessed} lines, ${linesParsed} parsed, ${linesFailed} skipped.`);
        _wsConnected = false;
        if (isRecording) {
            appendToTerminal('[Error] WebSocket bridge disconnected while recording!');
            appendToTerminal('[Info] Data collected so far is safe. Restart the bridge and reconnect to continue.');
        }
        if (origOnclose) origOnclose();
    };
}

/**
 * Process a single line of data from the detector
 * 
 * Expected formats (in order of priority):
 * Format 1 (PRIMARY): TAB-separated from MuNRa detector:
 *   "event_id \t timestamp \t adc \t sipm_mV \t voltage_V \t pressure_Pa \t temp_C \t deadtime \t coincident \t COSMIC"
 *   Example: "9	332741	50	225	0.3	76363.0	28.1	44572	0	COSMIC"
 * 
 * Format 2: JSON object
 * Format 3: Key-value pairs "TRG 1 CH 1 ADC 245..."
 * Format 4: Comma-separated CSV
 */
function processDataLine(line, enableRealtime) {
    // Update terminal display - show raw data exactly as received
    appendToTerminal(line);
    
    // ─── Skip header / info lines ───────────────────────────────────
    // The detector sends a header like:
    //   "Event TimeStamp[ms] ADC1 ADC2 SiPM[mV] Pressure[Pa] Temp[C] DeadTime[us] Coe..."
    // Also skip lines that are clearly NOT data (contain brackets, labels, etc.)
    if (/^[A-Za-z]/.test(line) || line.includes('[') || line.includes('Event') || line.includes('TimeStamp')) {
        return false;
    }
    
    // Skip empty or very short lines
    if (line.length < 5 || !/\d/.test(line)) {
        return false;
    }
    
    let parsedData = null;
    
    // Try different formats in order of priority
    if (line.startsWith('{')) {
        // JSON format
        try {
            parsedData = JSON.parse(line);
        } catch (e) {
            console.warn('Invalid JSON:', line);
            return false;
        }
    } else if (/^\d+[\t ]+\d+[\t ]+\d+/.test(line)) {
        // PRIMARY FORMAT: Space/tab-separated numeric data from MuNRa detector
        // Lines starting with 3+ numbers separated by spaces/tabs
        // Format: EventID Timestamp ADC1 ADC2 SiPM Pressure Temp DeadTime Coincident [COSMIC]
        parsedData = parseTabSeparatedLine(line);
    } else if (line.includes('COSMIC')) {
        // Contains COSMIC marker — try tab/space parser
        parsedData = parseTabSeparatedLine(line);
    } else if (line.includes('TRG') && /TRG\s+\d/.test(line)) {
        // Key-value format: "TRG 1 CH 1 ADC 245 TEMP 22.5 PRES 101320 DT 0.15"
        // Must have "TRG" followed by a number to distinguish from headers
        parsedData = parseKeyValueLine(line);
    } else if (line.includes(',') && /^\d/.test(line)) {
        // CSV format (must start with a digit)
        parsedData = parseCSVLine(line);
    } else if (/^\d+\s+\d+/.test(line)) {
        // Fallback: lines starting with 2+ numbers
        parsedData = parseSpaceSeparatedLine(line);
    }
    
    if (!parsedData) {
        return false;
    }
    
    // ─── ALL DATA IS PROCESSED — no filtering, no validation ───────
    // Scientific data is NEVER discarded regardless of values.
    
    // Log first successful parse so user can confirm data is flowing
    if (!processDataLine._firstParsed) {
        processDataLine._firstParsed = true;
        appendToTerminal(`[OK] ✓ First data parsed! sipm=${parsedData.sipm}mV temp=${parsedData.temp}°C pres=${parsedData.pressure}Pa`);
    }
    
    try {
        aggregateData(parsedData);
    } catch (e) {
        appendToTerminal(`[Error] aggregateData crashed: ${e.message}`);
        return false;
    }
    
    try {
        const nowMinute = Math.floor(Date.now() / 60000);
        if (currentMinute !== null && nowMinute !== currentMinute) {
            if (_firstMinuteIsPartial) {
                // First minute started mid-way — discard like last partial minute
                appendToTerminal(`[System] Discarding first partial minute (${minuteData.eventCount} events in incomplete minute) — only complete minutes are saved.`);
                _firstMinuteIsPartial = false;
            } else {
                saveMinuteData();
            }
            resetMinuteData();
            currentMinute = nowMinute;
        }
    } catch (e) {
        appendToTerminal(`[Error] saveMinuteData crashed: ${e.message}`);
    }
    
    try {
        // Push realtime data to local in-memory buffer for immediate 1m/5m chart display.
        // This works regardless of enableRealtime — no Firebase writes, no bandwidth.
        if (recordingProfile && typeof DataManager !== 'undefined' && DataManager.pushLocalRealtime) {
            DataManager.pushLocalRealtime({
                ts: parsedData.timestamp,
                sipm: parsedData.sipm,
                temp: parsedData.temp,
                pressure: parsedData.pressure,
                deadtime: parsedData.deadtime,
                coincident: parsedData.coincident
            });
        }
        // Only write to Firebase if enableRealtime is ON (uses download bandwidth).
        if (enableRealtime && recordingProfile) {
            saveRealtimeData(parsedData);
        }
    } catch (e) {
        console.error('saveRealtimeData error:', e);
    }
    
    try {
        updateLatestData(parsedData);
    } catch (e) {
        appendToTerminal(`[Error] updateLatestData crashed: ${e.message}`);
    }
    
    return true; // Successfully processed
}

/**
 * Parse key-value format line
 * Example: "TRG 1 CH 1 ADC 245 TEMP 22.5 PRES 101320 DT 0.15"
 */
function parseKeyValueLine(line) {
    const parts = line.split(/\s+/);
    const data = {
        timestamp: Date.now(),
        trg: 0,
        sipm: 0,
        temp: null,
        pressure: null,
        deadtime: null,
        coincident: 0
    };
    
    for (let i = 0; i < parts.length - 1; i += 2) {
        const key = parts[i].toUpperCase();
        const value = parseFloat(parts[i + 1]);
        
        switch (key) {
            case 'TRG':
                data.trg = value;
                break;
            case 'ADC':
                // Convert ADC to mV (typical conversion: ADC * 0.5)
                data.sipm = value * 0.5;
                break;
            case 'SIPM':
            case 'MV':
                data.sipm = value;
                break;
            case 'TEMP':
            case 'T':
                data.temp = value;
                break;
            case 'PRES':
            case 'P':
                data.pressure = value;
                break;
            case 'DT':
            case 'DEADTIME':
                data.deadtime = value;
                break;
            case 'COIN':
            case 'COINCIDENT':
                data.coincident = value;
                break;
            case 'TIME':
            case 'TS':
                data.timestamp = value;
                break;
        }
    }
    
    return data;
}

/**
 * Parse TAB/SPACE-separated format line from MuNRa detector
 * This is the PRIMARY format from the actual cosmic ray detector
 * 
 * Actual format from detector (confirmed from hardware):
 *   Event TimeStamp[ms] ADC1 ADC2 SiPM[mV] Pressure[Pa] Temp[C] DeadTime[us] Coincident COSMIC
 *   Example: "270 111753 60 1881 0.9 76501.6 27.1 46100 0 COSMIC"
 * 
 * Column mapping:
 * [0] Event ID/counter            (270)
 * [1] Timestamp ms (internal)     (111753)
 * [2] ADC1 raw value              (60)
 * [3] ADC2 raw value              (1881)
 * [4] SiPM signal in mV           (0.9)
 * [5] Pressure in Pascals         (76501.6)
 * [6] Temperature in Celsius      (27.1)
 * [7] Dead time in microseconds   (46100)
 * [8] Coincident flag (0 or 1)    (0)
 * [9] "COSMIC" marker (optional)
 */
function parseTabSeparatedLine(line) {
    // Split by tab(s) or multiple spaces — detector may send either
    const parts = line.split(/[\t ]+/).map(p => p.trim()).filter(p => p !== '');
    
    if (parts.length < 7) {
        console.warn('Tab-separated line has insufficient columns:', parts.length, 'expected at least 7');
        return null;
    }
    
    // Parse each column according to the ACTUAL detector format
    const eventId = parseInt(parts[0]) || 0;
    const detectorTimestamp = parseInt(parts[1]) || 0;
    const adc1 = parseInt(parts[2]) || 0;
    const adc2 = parseInt(parts[3]) || 0;
    const sipmMv = parseFloat(parts[4]) || 0;            // SiPM in mV
    const pressurePa = parseFloat(parts[5]) || 0;        // Pressure in Pascals
    const tempC = parseFloat(parts[6]) || 0;             // Temperature in Celsius
    const deadtimeUs = parseInt(parts[7]) || 0;           // Deadtime in microseconds
    const coincident = parseInt(parts[8]) || 0;
    // parts[9] is "COSMIC" marker, we ignore it
    
    return {
        timestamp: Date.now(),                           // Use current time for database
        eventId: eventId,
        detectorTimestamp: detectorTimestamp,
        adc1: adc1,
        adc2: adc2,
        sipm: sipmMv,                                    // SiPM in mV (column 4)
        temp: tempC,                                     // Temperature °C (column 6)
        pressure: pressurePa,                            // Pressure Pa (column 5)
        deadtime: deadtimeUs / 1000000,                  // Convert μs → ratio (0-1) for storage
        coincident: coincident,
        trg: 1                                           // Assume triggered if we received data
    };
}

/**
 * Parse space-separated line (fallback for simple numeric data)
 * Tries to interpret space-separated numbers in the same order as TAB format
 */
function parseSpaceSeparatedLine(line) {
    const parts = line.split(/\s+/).map(p => p.trim()).filter(p => p !== '' && p !== 'COSMIC');
    
    if (parts.length < 7) {
        return null;
    }
    
    // Same column mapping as TAB-separated
    return parseTabSeparatedLine(parts.join('\t'));
}

/**
 * Parse CSV format line
 * Expected format: "trg,sipm,temp,pressure,deadtime,coincident,timestamp"
 */
function parseCSVLine(line) {
    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length < 5) {
        return null;
    }
    
    return {
        timestamp: parts[6] ? parseInt(parts[6]) : Date.now(),
        trg: parseInt(parts[0]) || 1,
        sipm: parseFloat(parts[1]) || 0,
        temp: parts[2] ? parseFloat(parts[2]) : null,
        pressure: parts[3] ? parseFloat(parts[3]) : null,
        deadtime: parts[4] ? parseFloat(parts[4]) : null,
        coincident: parseInt(parts[5]) || 0
    };
}

/**
 * Aggregate data for minute averaging
 * CRITICAL: This calculates AVERAGES, not sums!
 */
function aggregateData(data) {
    minuteData.eventCount++;
    
    if (data.coincident === 1) {
        minuteData.coincidentCount++;
    }
    
    // SiPM
    minuteData.sipmSum += data.sipm;
    minuteData.sipmMin = Math.min(minuteData.sipmMin, data.sipm);
    minuteData.sipmMax = Math.max(minuteData.sipmMax, data.sipm);
    
    // Temperature
    if (data.temp !== null && data.temp !== undefined) {
        minuteData.tempSum += data.temp;
        minuteData.tempCount++;
    }
    
    // Pressure
    if (data.pressure !== null && data.pressure !== undefined) {
        minuteData.pressureSum += data.pressure;
        minuteData.pressureCount++;
    }
    
    // Deadtime
    if (data.deadtime !== null && data.deadtime !== undefined) {
        minuteData.deadtimeSum += data.deadtime;
        minuteData.deadtimeCount++;
    }
}

/**
 * Reset minute data for new minute
 */
function resetMinuteData() {
    minuteData = {
        eventCount: 0,
        coincidentCount: 0,
        sipmSum: 0,
        sipmMin: Infinity,
        sipmMax: -Infinity,
        tempSum: 0,
        tempCount: 0,
        pressureSum: 0,
        pressureCount: 0,
        deadtimeSum: 0,
        deadtimeCount: 0
    };
}

/**
 * Save aggregated minute data to Firebase
 * CRITICAL: Data is AVERAGED, not summed!
 */
async function saveMinuteData() {
    if (!recordingProfile || !recordingSession) {
        appendToTerminal('[Error] Cannot save: no recording profile/session active.');
        return;
    }
    if (minuteData.eventCount === 0) {
        return;
    }
    
    const timestamp = currentMinute * 60; // Unix timestamp in seconds
    const writePath = `profiles/${recordingProfile}/sessions/${recordingSession}/minutes/${timestamp}`;
    
    // Calculate AVERAGES (not sums!)
    const avgData = {
        ec: minuteData.eventCount,                                    // Event count
        cc: minuteData.coincidentCount,                               // Coincident count (muons)
        sm: Math.round((minuteData.sipmSum / minuteData.eventCount) * 10) / 10,  // SiPM AVERAGE
        sn: minuteData.sipmMin === Infinity ? 0 : Math.round(minuteData.sipmMin * 10) / 10,  // SiPM min
        sx: minuteData.sipmMax === -Infinity ? 0 : Math.round(minuteData.sipmMax * 10) / 10, // SiPM max
        tp: minuteData.tempCount > 0 ? Math.round((minuteData.tempSum / minuteData.tempCount) * 10) / 10 : null,  // Temp AVERAGE
        pr: minuteData.pressureCount > 0 ? Math.round(minuteData.pressureSum / minuteData.pressureCount) : null,  // Pressure AVERAGE
        dt: minuteData.deadtimeCount > 0 ? Math.round((minuteData.deadtimeSum / minuteData.deadtimeCount) * 1000) / 1000 : null  // Deadtime AVERAGE
    };
    
    appendToTerminal(`[System] Writing minute to: ${writePath}`);
    
    try {
        await firebase.database()
            .ref(writePath)
            .set(avgData);
        
        const timeStr = new Date(timestamp * 1000).toLocaleTimeString();
        console.log(`Minute data saved: ${timeStr}`, avgData);
        appendToTerminal(`[OK] ✓ Minute saved → ${timeStr} | ${avgData.ec} events, SiPM avg ${avgData.sm} mV, Temp ${avgData.tp}°C, Pressure ${avgData.pr} Pa`);
    } catch (error) {
        console.error('Error saving minute data:', error);
        const errMsg = (error.message || '').toUpperCase();
        if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('PERMISSION DENIED')) {
            appendToTerminal('[Error] DATABASE PERMISSION DENIED — this is NOT a serial port error.');
            appendToTerminal('[Error] Your account does not have write access to this profile.');
            appendToTerminal('[Error] Check: (1) Are you logged in? (2) Do you own or have edit access to this profile?');
            const user = firebase.auth().currentUser;
            if (!user) {
                appendToTerminal('[Error] You are NOT logged in. Log in first, then try recording again.');
            } else {
                appendToTerminal(`[Error] Logged in as: ${user.email} — verify this account owns profile "${recordingProfile}".`);
            }
            appendToTerminal('[Error] If the problem persists, check Firebase database rules in the console.');
        } else {
            appendToTerminal(`[Error] Failed to save minute data: ${error.message}`);
        }
    }
}

/**
 * Save real-time data point to Firebase (expensive, use sparingly)
 */
async function saveRealtimeData(data) {
    if (!recordingProfile) return;
    
    try {
        await firebase.database()
            .ref(`profiles/${recordingProfile}/realtime/${data.timestamp}`)
            .set({
                ts: data.timestamp,
                sipm: data.sipm,
                temp: data.temp,
                pressure: data.pressure,
                deadtime: data.deadtime,
                coincident: data.coincident
            });
    } catch (error) {
        console.error('Error saving realtime data:', error);
    }
}

/**
 * Update latest data point for live display
 * Note: Uses seconds for backward compatibility with existing app.js code
 */
// Throttle latest data updates to max once per second (avoid flooding Firebase)
let _lastLatestUpdate = 0;
let _latestWriteErrors = 0;

async function updateLatestData(data) {
    if (!recordingProfile) return;
    
    // Throttle: max 1 update per second
    const now = Date.now();
    if (now - _lastLatestUpdate < 1000) return;
    _lastLatestUpdate = now;
    
    try {
        await firebase.database()
            .ref(`profiles/${recordingProfile}/latest`)
            .set({
                ts: Math.floor(data.timestamp / 1000), // seconds for compatibility
                sipm: data.sipm,
                temp: data.temp,
                pressure: data.pressure,
                deadtime: data.deadtime,
                ec: minuteData.eventCount
            });
        // Reset error counter on success
        if (_latestWriteErrors > 0) {
            appendToTerminal(`[OK] Firebase writes resumed after ${_latestWriteErrors} errors.`);
            _latestWriteErrors = 0;
        }
    } catch (error) {
        _latestWriteErrors++;
        const errMsg = (error.message || '').toUpperCase();
        // Log first error and then every 10th error (avoid spam but don't hide issues)
        if (_latestWriteErrors === 1) {
            if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('PERMISSION DENIED')) {
                appendToTerminal('[Error] DATABASE PERMISSION DENIED on live data write.');
                appendToTerminal('[Error] Check: Are you logged in? Do you own this profile?');
            } else {
                console.error('Error updating latest data:', error);
                appendToTerminal(`[Error] Firebase write failed: ${error.message}`);
            }
        } else if (_latestWriteErrors % 10 === 0) {
            appendToTerminal(`[Error] Firebase write failed (${_latestWriteErrors}x): ${error.message}`);
        }
    }
}

/**
 * Cleanup old real-time data (older than 5 minutes)
 * Uses orderByChild('ts') for proper numeric comparison
 */
async function cleanupRealtimeData(profileId) {
    if (!profileId) return;
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    try {
        const ref = firebase.database().ref(`profiles/${profileId}/realtime`);
        // Use orderByChild('ts') for proper numeric comparison
        const snapshot = await ref.orderByChild('ts').endAt(fiveMinutesAgo).once('value');
        
        const updates = {};
        snapshot.forEach(child => {
            updates[child.key] = null;
        });
        
        if (Object.keys(updates).length > 0) {
            await ref.update(updates);
            console.log(`Cleaned up ${Object.keys(updates).length} old realtime records`);
        }
    } catch (error) {
        console.error('Error cleaning up realtime data:', error);
    }
}

/**
 * Append line to terminal output display
 * Sends to both the old terminalOutput element (if exists) and the
 * in-chart terminal slot managed by ChartManager.
 */
function appendToTerminal(line) {
    const ts = new Date().toLocaleTimeString();
    const formattedLine = `[${ts}] ${line}`;

    // In-chart terminal (via ChartManager)
    if (typeof ChartManager !== 'undefined' && ChartManager.appendTerminalLine) {
        let cls = '';
        if (line.startsWith('[System]') || line.startsWith('[SYSTEM'))  cls = 'term-system';
        else if (line.startsWith('[Error]')) cls = 'term-error';
        else if (line.startsWith('[OK]') || line.startsWith('[Success]')) cls = 'term-good';
        else cls = 'term-data';
        const escaped = formattedLine.replace(/</g, '&lt;');
        ChartManager.appendTerminalLine(`<span class="${cls}">${escaped}</span>`);
    }

    // Legacy terminalOutput element (standalone terminal.html or old modal)
    if (terminalOutput) {
        const lineElement = document.createElement('div');
        lineElement.className = 'terminal-line';
        lineElement.textContent = formattedLine;
        terminalOutput.appendChild(lineElement);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        while (terminalOutput.children.length > 1000) {
            terminalOutput.removeChild(terminalOutput.firstChild);
        }
    }
}

/**
 * Show the detector setup modal (v4.2).
 * The modal already exists in index.html — we just open it.
 * If called from terminal.html (standalone), this is a no-op.
 */
function showSerialTerminal() {
    const modal = document.getElementById('detectorSetupModal');
    if (modal) modal.classList.add('active');
}

/**
 * Hide detector setup modal (v4.2)
 */
function hideSerialTerminal() {
    const modal = document.getElementById('detectorSetupModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Populate profile select in serial terminal
 * Shows profiles that the current user can write data to:
 * - Profiles owned by the user
 * - Profiles shared with edit permission
 * - For admins, all profiles
 */
function populateSerialProfileSelect() {
    const select = document.getElementById('serialProfileSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select profile...</option>';
    
    if (typeof allProfiles === 'undefined' || !allProfiles) {
        console.warn('No profiles available for serial terminal');
        return;
    }
    
    // Get current user info (from auth.js globals)
    const isAdmin = typeof isUserAdmin === 'function' && isUserAdmin();
    const currentUserId = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : null;
    
    // Group profiles
    const myProfiles = [];
    const sharedWithMe = [];
    const publicProfiles = [];
    
    Object.keys(allProfiles).forEach(id => {
        const profile = allProfiles[id];
        const name = profile.name || profile.meta?.name || id;
        
        // Check ownership
        const isOwner = currentUserId && profile.ownerUid === currentUserId;
        const hasEditAccess = profile.sharedWith && currentUserId && profile.sharedWith[currentUserId] === 'edit';
        const isPublicEditable = profile.visibility === 'public' && isAdmin;
        
        if (isOwner) {
            myProfiles.push({ id, name, profile });
        } else if (hasEditAccess) {
            sharedWithMe.push({ id, name, profile });
        } else if (isPublicEditable) {
            publicProfiles.push({ id, name, profile });
        }
    });
    
    // Add "My Profiles" section
    if (myProfiles.length > 0) {
        const optgroup1 = document.createElement('optgroup');
        optgroup1.label = 'My Profiles';
        myProfiles.forEach(({ id, name }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            optgroup1.appendChild(option);
        });
        select.appendChild(optgroup1);
    }
    
    // Add "Shared with Me" section
    if (sharedWithMe.length > 0) {
        const optgroup2 = document.createElement('optgroup');
        optgroup2.label = 'Shared with Me';
        sharedWithMe.forEach(({ id, name }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            optgroup2.appendChild(option);
        });
        select.appendChild(optgroup2);
    }
    
    // Add "Public Profiles" section (only for admins)
    if (isAdmin && publicProfiles.length > 0) {
        const optgroup3 = document.createElement('optgroup');
        optgroup3.label = 'Public Profiles (Admin)';
        publicProfiles.forEach(({ id, name }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            optgroup3.appendChild(option);
        });
        select.appendChild(optgroup3);
    }
    
    // If no profiles found, show a message
    if (myProfiles.length === 0 && sharedWithMe.length === 0 && !(isAdmin && publicProfiles.length > 0)) {
        select.innerHTML = '<option value="">No writable profiles found. Create one first.</option>';
    }
}

/**
 * Handle connect button click.
 * Displays detailed, multi-line error diagnostics on failure.
 */
async function handleSerialConnect() {
    try {
        await connectSerialPort();
        
        // Update UI
        document.getElementById('serialStatus').innerHTML = 'Connected';
        document.getElementById('serialStatus').style.background = '#28a745';
        document.getElementById('serialConnectBtn').disabled = true;
        document.getElementById('serialDisconnectBtn').disabled = false;
        document.getElementById('startRecordingBtn').disabled = false;
        
        const os = detectOS();
        const mode = _connectionMode === 'websocket' ? 'WebSocket Bridge' : 'Web Serial API';
        appendToTerminal(`[OK] Connected via ${mode} (${os})`);
    } catch (error) {
        // Display each line of the diagnostic as a separate terminal line
        const diagLines = (error.message || 'Unknown error').split('\n');
        diagLines.forEach(line => {
            if (line.trim()) appendToTerminal(`[Error] ${line}`);
        });
        if (typeof showToast === 'function') {
            // Toast gets just the first line (short summary)
            showToast('Connection failed: ' + diagLines[0], 'error');
        }
    }
}

/**
 * Handle disconnect button click
 */
async function handleSerialDisconnect() {
    try {
        await disconnectSerialPort();
        
        // Update UI
        document.getElementById('serialStatus').innerHTML = 'Disconnected';
        document.getElementById('serialStatus').style.background = '#dc3545';
        document.getElementById('serialConnectBtn').disabled = false;
        document.getElementById('serialDisconnectBtn').disabled = true;
        document.getElementById('startRecordingBtn').disabled = true;
        document.getElementById('stopRecordingBtn').disabled = true;
        
        appendToTerminal('[System] Serial port disconnected.');
    } catch (error) {
        appendToTerminal(`[Error] ${error.message}`);
    }
}

/**
 * Handle start recording button click
 */
async function handleStartRecording() {
    const profileSelect = document.getElementById('serialProfileSelect');
    const enableRealtime = document.getElementById('enableRealtimeCheck')?.checked || false;
    
    if (!profileSelect || !profileSelect.value) {
        if (typeof showToast === 'function') {
            showToast('Please select a profile first', 'error');
        }
        return;
    }
    
    try {
        const sessionId = await startRecording(profileSelect.value, enableRealtime);
        
        // Update UI
        document.getElementById('startRecordingBtn').disabled = true;
        document.getElementById('stopRecordingBtn').disabled = false;
        document.getElementById('serialProfileSelect').disabled = true;
        document.getElementById('terminalSession').textContent = sessionId.split('_')[1];
        
        appendToTerminal(`[System] Recording started! Session: ${sessionId}`);
        
        // Start realtime data cleanup (always, since realtime data is always saved now)
        startRealtimeCleanup();
    } catch (error) {
        appendToTerminal(`[Error] ${error.message}`);
        if (typeof showToast === 'function') {
            showToast('Failed to start recording: ' + error.message, 'error');
        }
    }
}

/**
 * Handle stop recording button click
 */
async function handleStopRecording() {
    try {
        await stopRecording();
        
        // Update UI
        document.getElementById('startRecordingBtn').disabled = false;
        document.getElementById('stopRecordingBtn').disabled = true;
        document.getElementById('serialProfileSelect').disabled = false;
        document.getElementById('terminalSession').textContent = 'None';
        
        appendToTerminal('[System] Recording stopped.');
        
        // Stop realtime cleanup
        stopRealtimeCleanup();
    } catch (error) {
        appendToTerminal(`[Error] ${error.message}`);
    }
}

// Cleanup state
let cleanupInterval = null;
let cleanupStartTimeout = null;
let cleanupStopTimeout = null;

/**
 * Start periodic cleanup of old realtime data.
 * Cleanup begins 5 minutes after recording starts (to give data time to accumulate).
 * This avoids cleaning up data that is still being displayed.
 */
function startRealtimeCleanup() {
    // Cancel any pending stop from a previous session
    if (cleanupStopTimeout) { clearTimeout(cleanupStopTimeout); cleanupStopTimeout = null; }

    if (cleanupInterval || cleanupStartTimeout) return; // already scheduled or running

    console.log('[Cleanup] Scheduled to start in 5 minutes...');
    cleanupStartTimeout = setTimeout(() => {
        cleanupStartTimeout = null;
        if (!recordingProfile) return; // recording may have stopped in the meantime

        console.log('[Cleanup] Starting periodic realtime cleanup.');
        _runCleanupNow();
        cleanupInterval = setInterval(() => {
            _runCleanupNow();
        }, PERF.CLEANUP_INTERVAL_MS);
    }, PERF.REALTIME_RETENTION_MS); // 5 minutes
}

/**
 * Schedule cleanup to wind down after recording stops.
 * Continues for 5 more minutes, then stops when no realtime data remains in DB.
 */
function stopRealtimeCleanup() {
    // Cancel the start timeout if cleanup hasn't begun yet
    if (cleanupStartTimeout) {
        clearTimeout(cleanupStartTimeout);
        cleanupStartTimeout = null;
        console.log('[Cleanup] Recording stopped before cleanup started. Cancelled.');
        return;
    }

    if (!cleanupInterval) return; // nothing running

    console.log('[Cleanup] Recording stopped. Cleanup continues for 5 more minutes...');

    cleanupStopTimeout = setTimeout(async () => {
        cleanupStopTimeout = null;
        // Final cleanup pass
        await _runCleanupNow();
        // Stop interval
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
            cleanupInterval = null;
        }
        console.log('[Cleanup] Final cleanup complete. Cleanup stopped.');
    }, PERF.REALTIME_RETENTION_MS); // 5 minutes after stop
}

/** Execute a single cleanup pass for the recording profile */
async function _runCleanupNow() {
    const profileId = recordingProfile || _lastCleanupProfile;
    if (!profileId) return;
    _lastCleanupProfile = profileId;

    try {
        await cleanupRealtimeData(profileId);
    } catch (e) {
        console.error('[Cleanup] Error during cleanup:', e);
    }
}

// Track last profile for post-recording cleanup
let _lastCleanupProfile = null;

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    window.isSerialSupported = isSerialSupported;
    window.getSerialCompatInfo = getSerialCompatInfo;
    window.detectOS = detectOS;
    window.detectBrowser = detectBrowser;
    window.connectSerialPort = connectSerialPort;
    window.connectWebSocketBridge = connectWebSocketBridge;
    window.disconnectSerialPort = disconnectSerialPort;
    window.disconnectWebSocketBridge = disconnectWebSocketBridge;
    window.startRecording = startRecording;
    window.stopRecording = stopRecording;
    window.showSerialTerminal = showSerialTerminal;
    window.hideSerialTerminal = hideSerialTerminal;
    window.handleSerialConnect = handleSerialConnect;
    window.handleSerialDisconnect = handleSerialDisconnect;
    window.handleStartRecording = handleStartRecording;
    window.handleStopRecording = handleStopRecording;
}
