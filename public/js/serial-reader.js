/**
 * MuNRa 4.0 - Web Serial API Data Reader
 * 
 * Reads data directly from particle detector via USB serial port.
 * Uses the Web Serial API available in Chrome/Edge browsers.
 * 
 * SCIENTIFIC INTEGRITY NOTE:
 * This system NEVER discards or modifies data received from the detector.
 * High-intensity cosmic ray signals can legitimately reach ~1V from SiPM.
 * All measurements are preserved exactly as received for scientific accuracy.
 * 
 * If extreme values persist for extended periods, users are NOTIFIED
 * (not blocked) so they can check for potential system issues.
 * 
 * Data Format from Detector (example line):
 * TRG 1 CH 1 ADC 245 TEMP 22.5 PRES 101320 DT 0.15 CNT 1234 TIME 1704067261234
 * 
 * Fields:
 * - TRG: Trigger (1 = event detected)
 * - CH: Channel number
 * - ADC: SiPM signal in ADC counts (convert to mV: ADC * 0.5)
 * - TEMP: Temperature in Celsius
 * - PRES: Pressure in Pascals
 * - DT: Deadtime ratio (0-1)
 * - CNT: Event counter
 * - TIME: Unix timestamp in milliseconds
 */

// Serial connection state
let serialPort = null;
let serialReader = null;
let serialWriter = null;
let isSerialConnected = false;
let isRecording = false;
let recordingProfile = null;
let recordingSession = null;

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

// Warning thresholds for extreme values (NOTIFICATION only - NO data discarding)
// SCIENTIFIC NOTE: These thresholds are for WARNINGS only. All data is preserved
// regardless of values. High-intensity cosmic ray signals can reach ~1V from SiPM.
const WARNING_THRESHOLDS = {
    sipm: { typical_max: 500, extreme_max: 1000, unit: 'mV' },  // SiPM signal - warn above 500mV, extreme above 1000mV
    temp: { min: -40, max: 85, unit: '°C' },                     // Temperature -40 to 85°C
    pressure: { min: 80000, max: 120000, unit: 'Pa' },           // Pressure 80-120 kPa
    deadtime: { min: 0, max: 1, unit: 'ratio' }                  // Deadtime 0-1
};

// Extreme value tracking for prolonged anomaly detection
let extremeValueTracker = {
    sipm: { startTime: null, count: 0 },
    temp: { startTime: null, count: 0 },
    pressure: { startTime: null, count: 0 }
};
const EXTREME_VALUE_NOTIFICATION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes of continuous extreme values
const EXTREME_VALUE_COUNT_THRESHOLD = 50; // Minimum count before notification
let lastExtremeNotificationTime = 0;
const EXTREME_NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000; // Only notify every 10 minutes

// Terminal output element
let terminalOutput = null;

/**
 * Check if Web Serial API is available
 */
function isSerialSupported() {
    return 'serial' in navigator;
}

/**
 * Request and open a serial port connection
 */
async function connectSerialPort() {
    if (!isSerialSupported()) {
        throw new Error('Web Serial API not supported. Use Chrome or Edge browser.');
    }
    
    try {
        // Request port from user
        serialPort = await navigator.serial.requestPort();
        
        // Open with standard settings for MuNRa detector
        await serialPort.open({
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
        
        isSerialConnected = true;
        console.log('Serial port connected');
        
        return true;
    } catch (error) {
        console.error('Serial connection error:', error);
        throw error;
    }
}

/**
 * Disconnect from serial port
 */
async function disconnectSerialPort() {
    try {
        if (serialReader) {
            await serialReader.cancel();
            serialReader = null;
        }
        
        if (serialPort) {
            await serialPort.close();
            serialPort = null;
        }
        
        isSerialConnected = false;
        isRecording = false;
        console.log('Serial port disconnected');
        
        return true;
    } catch (error) {
        console.error('Serial disconnect error:', error);
        throw error;
    }
}

/**
 * Start reading data from serial port and recording to Firebase
 * @param {string} profileId - The profile ID to record data to
 * @param {boolean} enableRealtime - Whether to store real-time data (expensive)
 */
async function startRecording(profileId, enableRealtime = false) {
    if (!isSerialConnected || !serialPort) {
        throw new Error('Serial port not connected');
    }
    
    if (!profileId) {
        throw new Error('No profile selected');
    }
    
    recordingProfile = profileId;
    isRecording = true;
    
    // Create new session
    const sessionId = `session_${Date.now()}`;
    recordingSession = sessionId;
    
    // Initialize session in Firebase
    await firebase.database().ref(`profiles/${profileId}/sessions/${sessionId}`).set({
        startTime: Date.now(),
        name: `Session ${new Date().toLocaleString()}`,
        status: 'recording'
    });
    
    // Reset minute data
    resetMinuteData();
    currentMinute = Math.floor(Date.now() / 60000);
    
    // Start reading
    readSerialLoop(enableRealtime);
    
    console.log(`Recording started for profile: ${profileId}, session: ${sessionId}`);
    return sessionId;
}

/**
 * Stop recording
 */
async function stopRecording() {
    isRecording = false;
    
    // Finalize current minute if there's data
    if (minuteData.eventCount > 0) {
        await saveMinuteData();
    }
    
    // Update session status
    if (recordingProfile && recordingSession) {
        await firebase.database().ref(`profiles/${recordingProfile}/sessions/${recordingSession}`).update({
            endTime: Date.now(),
            status: 'completed'
        });
    }
    
    recordingProfile = null;
    recordingSession = null;
    
    console.log('Recording stopped');
}

/**
 * Main serial reading loop
 */
async function readSerialLoop(enableRealtime) {
    if (!serialPort || !serialPort.readable) return;
    
    const decoder = new TextDecoderStream();
    const inputDone = serialPort.readable.pipeTo(decoder.writable);
    serialReader = decoder.readable.getReader();
    
    let buffer = '';
    
    try {
        while (isRecording) {
            const { value, done } = await serialReader.read();
            
            if (done) break;
            
            if (value) {
                buffer += value;
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.trim()) {
                        processDataLine(line.trim(), enableRealtime);
                    }
                }
            }
        }
    } catch (error) {
        if (error.name !== 'NetworkError' && error.message !== 'The device has been lost.') {
            console.error('Serial read error:', error);
        }
    } finally {
        if (serialReader) {
            serialReader.releaseLock();
            serialReader = null;
        }
    }
}

/**
 * Process a single line of data from the detector
 * 
 * Expected formats:
 * Format 1: "TRG 1 CH 1 ADC 245 TEMP 22.5 PRES 101320 DT 0.15"
 * Format 2: "1,245,22.5,101320,0.15,0,1704067261234"  (CSV)
 * Format 3: JSON
 */
function processDataLine(line, enableRealtime) {
    // Update terminal display
    appendToTerminal(line);
    
    let parsedData = null;
    
    // Try different formats
    if (line.startsWith('{')) {
        // JSON format
        try {
            parsedData = JSON.parse(line);
        } catch (e) {
            console.warn('Invalid JSON:', line);
            return;
        }
    } else if (line.includes('TRG') || line.includes('ADC')) {
        // Key-value format: "TRG 1 CH 1 ADC 245 TEMP 22.5 PRES 101320 DT 0.15"
        parsedData = parseKeyValueLine(line);
    } else if (line.includes(',')) {
        // CSV format
        parsedData = parseCSVLine(line);
    } else {
        // Unknown format
        console.warn('Unknown data format:', line);
        return;
    }
    
    if (!parsedData) return;
    
    // Check for extreme values - WARN but DO NOT DISCARD data
    // SCIENTIFIC INTEGRITY: All data must be preserved regardless of values
    checkExtremeValues(parsedData);
    
    // Aggregate for minute data - ALL DATA IS PROCESSED
    aggregateData(parsedData);
    
    // Check if minute changed
    const nowMinute = Math.floor(Date.now() / 60000);
    if (currentMinute !== null && nowMinute !== currentMinute) {
        // Save previous minute
        saveMinuteData();
        resetMinuteData();
        currentMinute = nowMinute;
    }
    
    // Store real-time data if enabled (and cleanup old data)
    if (enableRealtime && recordingProfile) {
        saveRealtimeData(parsedData);
    }
    
    // Update latest data
    updateLatestData(parsedData);
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
 * Check for extreme values and track prolonged anomalies
 * 
 * CRITICAL SCIENTIFIC NOTE: This function ONLY logs warnings and tracks patterns.
 * It NEVER discards or modifies data. All measurements are preserved exactly as received.
 * 
 * High-intensity cosmic ray signals can legitimately reach ~1V from SiPM.
 * Prolonged extreme values (over 5 minutes) MAY indicate a system error and will
 * trigger a user notification suggesting they contact administrators.
 */
function checkExtremeValues(data) {
    const now = Date.now();
    let hasExtremeValue = false;
    let extremeDetails = [];
    
    // Check SiPM - values above typical_max are notable, but NOT invalid
    if (data.sipm !== undefined && data.sipm !== null) {
        if (data.sipm > WARNING_THRESHOLDS.sipm.extreme_max) {
            console.info(`⚡ High SiPM signal: ${data.sipm} mV (extreme, but data preserved)`);
            trackExtremeValue('sipm', now);
            hasExtremeValue = true;
            extremeDetails.push(`SiPM: ${data.sipm} mV`);
        } else if (data.sipm > WARNING_THRESHOLDS.sipm.typical_max) {
            console.info(`📊 Notable SiPM signal: ${data.sipm} mV (above typical, data preserved)`);
            trackExtremeValue('sipm', now);
            hasExtremeValue = true;
            extremeDetails.push(`SiPM: ${data.sipm} mV`);
        } else {
            // Reset tracker if value is normal
            resetExtremeTracker('sipm');
        }
        
        // Check for negative values (physically impossible but don't discard)
        if (data.sipm < 0) {
            console.warn(`⚠️ Negative SiPM value: ${data.sipm} mV - physically unusual, data preserved`);
        }
    }
    
    // Check Temperature
    if (data.temp !== undefined && data.temp !== null) {
        if (data.temp < WARNING_THRESHOLDS.temp.min || data.temp > WARNING_THRESHOLDS.temp.max) {
            console.info(`🌡️ Unusual temperature: ${data.temp} °C (outside typical range, data preserved)`);
            trackExtremeValue('temp', now);
            hasExtremeValue = true;
            extremeDetails.push(`Temp: ${data.temp} °C`);
        } else {
            resetExtremeTracker('temp');
        }
    }
    
    // Check Pressure
    if (data.pressure !== undefined && data.pressure !== null) {
        if (data.pressure < WARNING_THRESHOLDS.pressure.min || data.pressure > WARNING_THRESHOLDS.pressure.max) {
            console.info(`🔄 Unusual pressure: ${data.pressure} Pa (outside typical range, data preserved)`);
            trackExtremeValue('pressure', now);
            hasExtremeValue = true;
            extremeDetails.push(`Pressure: ${data.pressure} Pa`);
        } else {
            resetExtremeTracker('pressure');
        }
    }
    
    // Check Deadtime (physically constrained 0-1, but still don't discard)
    if (data.deadtime !== undefined && data.deadtime !== null) {
        if (data.deadtime < 0 || data.deadtime > 1) {
            console.warn(`⏱️ Unusual deadtime: ${data.deadtime} (outside 0-1 range, data preserved)`);
        }
    }
    
    // Check for prolonged extreme values and notify user if needed
    if (hasExtremeValue) {
        checkProlongedExtremeValues(extremeDetails.join(', '));
    }
}

/**
 * Track the start time and count of extreme values
 */
function trackExtremeValue(type, now) {
    if (!extremeValueTracker[type].startTime) {
        extremeValueTracker[type].startTime = now;
        extremeValueTracker[type].count = 1;
    } else {
        extremeValueTracker[type].count++;
    }
}

/**
 * Reset the extreme value tracker for a type
 */
function resetExtremeTracker(type) {
    extremeValueTracker[type].startTime = null;
    extremeValueTracker[type].count = 0;
}

/**
 * Check if extreme values have persisted for too long and notify user
 * This suggests a potential system error (not bad data)
 */
function checkProlongedExtremeValues(details) {
    const now = Date.now();
    
    // Check each tracker for prolonged extreme values
    for (const [type, tracker] of Object.entries(extremeValueTracker)) {
        if (tracker.startTime && tracker.count >= EXTREME_VALUE_COUNT_THRESHOLD) {
            const duration = now - tracker.startTime;
            
            if (duration >= EXTREME_VALUE_NOTIFICATION_THRESHOLD_MS) {
                // Check cooldown to avoid spam
                if (now - lastExtremeNotificationTime >= EXTREME_NOTIFICATION_COOLDOWN_MS) {
                    lastExtremeNotificationTime = now;
                    
                    // Show notification to user
                    showExtremeValueNotification(type, tracker.count, duration, details);
                }
            }
        }
    }
}

/**
 * Show notification to user about prolonged extreme values
 * This suggests they may want to check the system and report to administrators
 */
function showExtremeValueNotification(type, count, duration, details) {
    const durationMinutes = Math.round(duration / 60000);
    
    const message = `⚠️ ATENCIÓN: Valores extremos detectados durante ${durationMinutes} minutos
    
📊 Tipo: ${type.toUpperCase()}
📈 Lecturas extremas: ${count}
📝 Últimos valores: ${details}

ℹ️ Los datos NO han sido descartados (se preserva la integridad científica).

Si esto no corresponde a un evento físico real, podría indicar un problema con el detector o la conexión.

🔧 Sugerencia: Verifique el estado del detector. Si el problema persiste, considere reportarlo a los administradores del sistema.`;
    
    console.warn(message);
    
    // Show toast notification if function is available
    if (typeof showToast === 'function') {
        showToast(`⚠️ Extreme values detected for ${durationMinutes}+ min. Check detector status.`, 'warning');
    }
    
    // Append to terminal
    appendToTerminal(`[SYSTEM WARNING] Prolonged extreme ${type} values (${count} readings over ${durationMinutes} min). Data preserved but may indicate system issue.`);
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
    if (!recordingProfile || !recordingSession || minuteData.eventCount === 0) return;
    
    const timestamp = currentMinute * 60; // Unix timestamp in seconds
    
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
    
    try {
        await firebase.database()
            .ref(`profiles/${recordingProfile}/sessions/${recordingSession}/minutes/${timestamp}`)
            .set(avgData);
        
        console.log(`Minute data saved: ${new Date(timestamp * 1000).toLocaleTimeString()}`, avgData);
    } catch (error) {
        console.error('Error saving minute data:', error);
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
async function updateLatestData(data) {
    if (!recordingProfile) return;
    
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
    } catch (error) {
        console.error('Error updating latest data:', error);
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
 */
function appendToTerminal(line) {
    if (!terminalOutput) return;
    
    const lineElement = document.createElement('div');
    lineElement.className = 'terminal-line';
    lineElement.textContent = `[${new Date().toLocaleTimeString()}] ${line}`;
    
    terminalOutput.appendChild(lineElement);
    
    // Auto-scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
    
    // Limit lines to prevent memory issues
    while (terminalOutput.children.length > 1000) {
        terminalOutput.removeChild(terminalOutput.firstChild);
    }
}

/**
 * Show the serial terminal modal/window
 */
function showSerialTerminal() {
    // Check if already exists
    let modal = document.getElementById('serialTerminalModal');
    if (modal) {
        modal.classList.add('active');
        return;
    }
    
    // Create modal
    modal = document.createElement('div');
    modal.id = 'serialTerminalModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; width: 90%; max-height: 90vh;">
            <div class="modal-header">
                <h2>🖥️ Serial Terminal - Detector Data</h2>
                <button class="modal-close" onclick="hideSerialTerminal()">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Connection Status -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div id="serialStatus" style="padding: 8px 15px; border-radius: 20px; background: #dc3545; color: white; font-size: 12px;">
                        ● Disconnected
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="serialConnectBtn" class="btn btn-primary" onclick="handleSerialConnect()">
                            🔌 Connect
                        </button>
                        <button id="serialDisconnectBtn" class="btn btn-secondary" onclick="handleSerialDisconnect()" disabled>
                            ⏹️ Disconnect
                        </button>
                    </div>
                </div>
                
                <!-- Recording Controls -->
                <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                        <div>
                            <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 5px;">Target Profile:</label>
                            <select id="serialProfileSelect" style="padding: 8px; border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);">
                                <option value="">Select profile...</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 5px;">
                                <input type="checkbox" id="enableRealtimeCheck"> Enable Real-time Data (expensive)
                            </label>
                        </div>
                        <button id="startRecordingBtn" class="btn btn-primary" onclick="handleStartRecording()" disabled>
                            🔴 Start Recording
                        </button>
                        <button id="stopRecordingBtn" class="btn btn-secondary" onclick="handleStopRecording()" disabled>
                            ⏹️ Stop
                        </button>
                    </div>
                </div>
                
                <!-- Terminal Output -->
                <div style="background: #0d1117; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 12px; height: 350px; overflow-y: auto;" id="serialTerminalOutput">
                    <div class="terminal-line" style="color: #8b949e;">[System] Terminal ready. Click 'Connect' to select serial port.</div>
                </div>
                
                <!-- Stats -->
                <div style="display: flex; gap: 20px; margin-top: 15px; font-size: 12px; color: var(--text-secondary);">
                    <span>Events: <strong id="terminalEventCount">0</strong></span>
                    <span>Last SiPM: <strong id="terminalLastSipm">-- mV</strong></span>
                    <span>Last Temp: <strong id="terminalLastTemp">-- °C</strong></span>
                    <span>Session: <strong id="terminalSession">None</strong></span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.add('active');
    
    // Set terminal output reference
    terminalOutput = document.getElementById('serialTerminalOutput');
    
    // Populate profile select
    populateSerialProfileSelect();
    
    // Add styles for terminal lines
    if (!document.getElementById('serialTerminalStyles')) {
        const style = document.createElement('style');
        style.id = 'serialTerminalStyles';
        style.textContent = `
            .terminal-line {
                color: #58a6ff;
                padding: 2px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .terminal-line:nth-child(even) {
                background: rgba(255,255,255,0.02);
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Hide serial terminal
 */
function hideSerialTerminal() {
    const modal = document.getElementById('serialTerminalModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Populate profile select in serial terminal
 */
function populateSerialProfileSelect() {
    const select = document.getElementById('serialProfileSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select profile...</option>';
    
    if (typeof allProfiles !== 'undefined') {
        Object.keys(allProfiles).forEach(id => {
            const profile = allProfiles[id];
            // Only show profiles user can edit
            if (typeof canEditProfile === 'function' && canEditProfile(profile, id)) {
                const name = profile.name || profile.meta?.name || id;
                select.innerHTML += `<option value="${id}">${name}</option>`;
            }
        });
    }
}

/**
 * Handle connect button click
 */
async function handleSerialConnect() {
    try {
        await connectSerialPort();
        
        // Update UI
        document.getElementById('serialStatus').innerHTML = '● Connected';
        document.getElementById('serialStatus').style.background = '#28a745';
        document.getElementById('serialConnectBtn').disabled = true;
        document.getElementById('serialDisconnectBtn').disabled = false;
        document.getElementById('startRecordingBtn').disabled = false;
        
        appendToTerminal('[System] Serial port connected successfully!');
    } catch (error) {
        appendToTerminal(`[Error] ${error.message}`);
        if (typeof showToast === 'function') {
            showToast('Failed to connect: ' + error.message, 'error');
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
        document.getElementById('serialStatus').innerHTML = '● Disconnected';
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
        
        // Start realtime data cleanup if enabled
        if (enableRealtime) {
            startRealtimeCleanup();
        }
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

// Cleanup interval reference
let cleanupInterval = null;

/**
 * Start periodic cleanup of old realtime data
 */
function startRealtimeCleanup() {
    if (cleanupInterval) return;
    
    cleanupInterval = setInterval(() => {
        if (recordingProfile) {
            cleanupRealtimeData(recordingProfile);
        }
    }, 60000); // Run every minute
}

/**
 * Stop periodic cleanup
 */
function stopRealtimeCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    window.isSerialSupported = isSerialSupported;
    window.connectSerialPort = connectSerialPort;
    window.disconnectSerialPort = disconnectSerialPort;
    window.startRecording = startRecording;
    window.stopRecording = stopRecording;
    window.showSerialTerminal = showSerialTerminal;
    window.hideSerialTerminal = hideSerialTerminal;
    window.handleSerialConnect = handleSerialConnect;
    window.handleSerialDisconnect = handleSerialDisconnect;
    window.handleStartRecording = handleStartRecording;
    window.handleStopRecording = handleStopRecording;
}
