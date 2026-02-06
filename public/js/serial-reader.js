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
        // Baud rate 9600 as used by: sudo minicom -D /dev/ttyACM0 -b 9600
        await serialPort.open({
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        });
        
        isSerialConnected = true;
        console.log('Serial port connected at 9600 baud');
        
        return true;
    } catch (error) {
        console.error('Serial connection error:', error);
        throw error;
    }
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
        
        if (serialReader) {
            try { await serialReader.cancel(); } catch (e) { /* ignore */ }
            try { serialReader.releaseLock(); } catch (e) { /* ignore */ }
            serialReader = null;
        }
        
        if (serialPort) {
            try { await serialPort.close(); } catch (e) { /* ignore */ }
            serialPort = null;
        }
        
        isSerialConnected = false;
        isRecording = false;
        console.log('Serial port disconnected');
        
        return true;
    } catch (error) {
        console.error('Serial disconnect error:', error);
        // Still try to clean up state
        isSerialConnected = false;
        isRecording = false;
        serialReader = null;
        serialPort = null;
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
    const user = firebase.auth().currentUser;
    appendToTerminal(`[System] User: ${user ? user.email : 'NOT LOGGED IN'}`);
    appendToTerminal(`[System] Profile: ${profileId}`);
    appendToTerminal(`[System] Session: ${sessionId}`);
    appendToTerminal(`[System] Writing to: profiles/${profileId}/sessions/${sessionId}/`);
    
    await firebase.database().ref(`profiles/${profileId}/sessions/${sessionId}`).set({
        startTime: Date.now(),
        name: `Session ${new Date().toLocaleString()}`,
        status: 'recording'
    });
    
    appendToTerminal('[OK] Session created in Firebase. Data will be saved every minute.');
    appendToTerminal(`[System] Current minute boundary: ${new Date(Math.floor(Date.now() / 60000) * 60000).toLocaleTimeString()}`);
    appendToTerminal(`[System] First save will happen at the next minute boundary.`);
    
    // Reset minute data and error counters
    resetMinuteData();
    currentMinute = Math.floor(Date.now() / 60000);
    _latestWriteErrors = 0;
    _lastLatestUpdate = 0;
    
    // Start reading
    readSerialLoop(enableRealtime);
    
    console.log(`Recording started for profile: ${profileId}, session: ${sessionId}`);
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
    
    // Finalize current minute if there's data
    if (minuteData.eventCount > 0) {
        appendToTerminal(`[System] Saving final minute data (${minuteData.eventCount} events)...`);
        try {
            await saveMinuteData();
        } catch (e) {
            appendToTerminal(`[Error] Failed to save final minute: ${e.message}`);
        }
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
        // ─── CRITICAL: Save any partial minute data before exiting ───
        if (minuteData.eventCount > 0 && recordingProfile && recordingSession) {
            appendToTerminal(`[System] Saving partial minute data (${minuteData.eventCount} events) before exit...`);
            try {
                await saveMinuteData();
            } catch (saveErr) {
                appendToTerminal(`[Error] Failed to save partial data: ${saveErr.message}`);
            }
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
    
    /**
     * Helper to track extreme values and build notification details
     */
    function recordExtreme(type, value, unit, message) {
        console.info(message);
        trackExtremeValue(type, now);
        hasExtremeValue = true;
        extremeDetails.push(`${type}: ${value} ${unit}`);
    }
    
    // Check SiPM - values above typical_max are notable, but NOT invalid
    if (data.sipm !== undefined && data.sipm !== null) {
        if (data.sipm > WARNING_THRESHOLDS.sipm.extreme_max) {
            recordExtreme('sipm', data.sipm, 'mV', `[HIGH] SiPM signal: ${data.sipm} mV (extreme, but data preserved)`);
        } else if (data.sipm > WARNING_THRESHOLDS.sipm.typical_max) {
            recordExtreme('sipm', data.sipm, 'mV', `[NOTE] SiPM signal: ${data.sipm} mV (above typical, data preserved)`);
        } else {
            // Reset tracker if value is normal
            resetExtremeTracker('sipm');
        }
        
        // Check for negative values (physically impossible but don't discard)
        if (data.sipm < 0) {
            console.warn(`[WARN] Negative SiPM value: ${data.sipm} mV - physically unusual, data preserved`);
        }
    }
    
    // Check Temperature
    if (data.temp !== undefined && data.temp !== null) {
        if (data.temp < WARNING_THRESHOLDS.temp.min || data.temp > WARNING_THRESHOLDS.temp.max) {
            recordExtreme('temp', data.temp, 'degC', `[WARN] Unusual temperature: ${data.temp} degC (outside typical range, data preserved)`);
        } else {
            resetExtremeTracker('temp');
        }
    }
    
    // Check Pressure
    if (data.pressure !== undefined && data.pressure !== null) {
        if (data.pressure < WARNING_THRESHOLDS.pressure.min || data.pressure > WARNING_THRESHOLDS.pressure.max) {
            recordExtreme('pressure', data.pressure, 'Pa', `[WARN] Unusual pressure: ${data.pressure} Pa (outside typical range, data preserved)`);
        } else {
            resetExtremeTracker('pressure');
        }
    }
    
    // Check Deadtime (physically constrained 0-1, but still don't discard)
    if (data.deadtime !== undefined && data.deadtime !== null) {
        if (data.deadtime < 0 || data.deadtime > 1) {
            console.warn(`[WARN] Unusual deadtime: ${data.deadtime} (outside 0-1 range, data preserved)`);
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
 * 
 * Message is bilingual (Spanish/English) since the user base includes Spanish speakers
 */
function showExtremeValueNotification(type, count, duration, details) {
    const durationMinutes = Math.round(duration / 60000);
    
    // Bilingual console message
    const message = `[WARNING / ADVERTENCIA] Extreme values detected / Valores extremos detectados
Duration / Duracion: ${durationMinutes} min
Type / Tipo: ${type.toUpperCase()}
Extreme readings / Lecturas extremas: ${count}
Latest values / Ultimos valores: ${details}

[INFO] Data has NOT been discarded (scientific integrity preserved).
       Los datos NO han sido descartados (se preserva la integridad cientifica).

If this doesn't correspond to a real physical event, it may indicate a detector or connection issue.
Si esto no corresponde a un evento fisico real, podria indicar un problema con el detector.

[SUGGESTION] Check detector status. If the problem persists, consider reporting to system administrators.
             Verifique el estado del detector. Si persiste, reporte a los administradores.`;
    
    console.warn(message);
    
    // Show toast notification if function is available
    if (typeof showToast === 'function') {
        showToast(`[WARNING] Extreme values for ${durationMinutes}+ min. Check detector / Verifique detector.`, 'warning');
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
        appendToTerminal(`[Error] Failed to save minute data: ${error.message}`);
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
        // Log first error and then every 10th error (avoid spam but don't hide issues)
        if (_latestWriteErrors === 1 || _latestWriteErrors % 10 === 0) {
            console.error('Error updating latest data:', error);
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
 * Handle connect button click
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
