#!/usr/bin/env python3
"""
MuNRa Serial-to-WebSocket Bridge
=================================
Connects ANY browser to the MuNRa particle detector via USB serial port.

This bridge reads data from the detector's serial port and forwards it
over WebSocket to the browser. It works with ALL browsers (Firefox,
Safari, Chrome, Edge, Opera — any browser that supports WebSocket).

It also SAVES ALL DATA locally to a timestamped file, so you don't need
to run minicom or screen separately. Data is saved to:
    munra_data_YYYYMMDD_HHMMSS.csv

Usage:
    python3 serial_bridge.py                    # Auto-detect port
    python3 serial_bridge.py /dev/ttyACM0       # Specify port (Linux)
    python3 serial_bridge.py COM3               # Specify port (Windows)
    python3 serial_bridge.py --no-save          # Don't save locally

Requirements (install once):
    pip3 install pyserial websockets

The bridge runs a WebSocket server on ws://localhost:8765.
MuNRa's terminal will auto-detect and connect to it.

NOTE: On Linux, your user must be in the 'dialout' group to access
serial ports without sudo:
    sudo usermod -a -G dialout $USER
    (then log out and back in)
"""

import sys
import os
import asyncio
import json
import signal
import time
import glob
import platform
from datetime import datetime

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print()
    print("=" * 50)
    print("  MISSING DEPENDENCY: pyserial")
    print("=" * 50)
    print()
    print("  Install it by running this command:")
    print()
    print("    pip3 install pyserial websockets")
    print()
    print("  Then run the bridge again:")
    print()
    print("    python3 serial_bridge.py")
    print()
    sys.exit(1)

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    try:
        import websockets
        # Older websockets versions
        serve = websockets.serve
    except ImportError:
        print()
        print("=" * 50)
        print("  MISSING DEPENDENCY: websockets")
        print("=" * 50)
        print()
        print("  Install it by running this command:")
        print()
        print("    pip3 install pyserial websockets")
        print()
        print("  Then run the bridge again:")
        print()
        print("    python3 serial_bridge.py")
        print()
        sys.exit(1)

# ─── Configuration ─────────────────────────────────────────────────
WS_HOST = "localhost"
WS_PORT = 8765
BAUD_RATE = 9600
DATA_BITS = 8
STOP_BITS = 1
PARITY = "none"

# ─── Globals ───────────────────────────────────────────────────────
# Use a dict to avoid Python's global scoping issues entirely.
# Dict method calls (.add, .discard) never need 'global' keyword.
state = {
    'clients': set(),      # Connected WebSocket clients
    'serial': None,        # Serial port handle
    'running': True,       # Main loop flag
    'data_file': None,     # Local data file handle
    'data_file_path': None,# Local data file path
    'save_locally': True,  # Whether to save data to local file
}

BRIDGE_VERSION = '1.1'


def detect_serial_ports():
    """Auto-detect available serial ports, prioritizing likely detector ports."""
    ports = serial.tools.list_ports.comports()
    candidates = []
    
    for port in ports:
        info = {
            "device": port.device,
            "description": port.description or "",
            "hwid": port.hwid or "",
            "manufacturer": port.manufacturer or "",
        }
        # Prioritize Arduino/detector-like ports
        score = 0
        desc = (port.description or "").lower()
        mfr = (port.manufacturer or "").lower()
        
        if "arduino" in desc or "arduino" in mfr:
            score += 10
        if "acm" in port.device.lower():
            score += 5
        if "usb" in desc.lower():
            score += 3
        if "ch340" in desc or "ftdi" in desc or "cp210" in desc:
            score += 4
        if "bluetooth" in desc.lower() or "bt" in desc.lower():
            score -= 10  # Deprioritize Bluetooth
            
        candidates.append((score, info))
    
    # Sort by score (highest first)
    candidates.sort(key=lambda x: -x[0])
    return [c[1] for c in candidates]


def print_banner():
    """Print startup banner."""
    os_name = platform.system()
    print()
    print("=" * 60)
    print("  MuNRa Serial-to-WebSocket Bridge  v" + BRIDGE_VERSION)
    print("  Connects ANY browser to the particle detector")
    print("=" * 60)
    print(f"  OS:        {os_name} ({platform.release()})")
    print(f"  Python:    {sys.version.split()[0]}")
    print(f"  WebSocket: ws://{WS_HOST}:{WS_PORT}")
    print(f"  Baud Rate: {BAUD_RATE}")
    print("=" * 60)
    print()


def open_serial(port_path):
    """Open the serial port with MuNRa detector settings."""
    
    try:
        state['serial'] = serial.Serial(
            port=port_path,
            baudrate=BAUD_RATE,
            bytesize=serial.EIGHTBITS,
            stopbits=serial.STOPBITS_ONE,
            parity=serial.PARITY_NONE,
            timeout=1,
            xonxoff=False,
            rtscts=False,
            dsrdtr=False,
        )
        print(f"[OK] Serial port opened: {port_path} at {BAUD_RATE} baud")
        return True
    except serial.SerialException as e:
        msg = str(e).lower()
        print(f"\n[ERROR] Cannot open {port_path}: {e}")
        
        if "permission" in msg or "access" in msg:
            if platform.system() == "Linux":
                print("\n  FIX: Add your user to the 'dialout' group:")
                print(f"    sudo usermod -a -G dialout {os_environ_user()}")
                print("    (then log out and back in)")
                print(f"\n  Quick test (temporary):")
                print(f"    sudo chmod 666 {port_path}")
            elif platform.system() == "Darwin":
                print("\n  FIX: Check System Preferences > Security & Privacy")
            elif platform.system() == "Windows":
                print("\n  FIX: Run this script as Administrator,")
                print("  or check Device Manager for the correct COM port.")
        
        elif "busy" in msg or "in use" in msg or "resource" in msg:
            print("\n  FIX: Another program is using this port.")
            print("  Close minicom, Arduino IDE, screen, or any other serial monitor.")
            if platform.system() == "Linux":
                print(f"  Find the process: sudo fuser {port_path}")
                print(f"  Kill it:          sudo fuser -k {port_path}")
        
        return False


def os_environ_user():
    """Get the current username."""
    import os
    return os.environ.get("USER", os.environ.get("USERNAME", "your_user"))


async def serial_reader():
    """Read serial data and broadcast to all WebSocket clients."""
    
    buffer = ""
    lines_sent = 0
    lines_saved = 0
    sp = state['serial']
    
    print("[OK] Serial reader loop started. Waiting for data...")
    if state['data_file']:
        print(f"[OK] Saving data locally to: {state['data_file_path']}")
    
    while state['running']:
        try:
            if sp and sp.is_open and sp.in_waiting > 0:
                raw = sp.read(sp.in_waiting)
                text = raw.decode("utf-8", errors="replace")
                buffer += text
                
                # Process complete lines
                lines = buffer.split("\n")
                buffer = lines.pop()  # Keep incomplete line
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Save to local file (replaces minicom)
                    if state['data_file'] and state['save_locally']:
                        try:
                            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                            state['data_file'].write(f"{ts}\t{line}\n")
                            state['data_file'].flush()
                            lines_saved += 1
                            if lines_saved == 1:
                                print(f"[OK] First line saved to file: {line[:80]}")
                            elif lines_saved % 500 == 0:
                                print(f"[Info] {lines_saved} lines saved to local file")
                        except Exception as fe:
                            print(f"[Warning] Could not write to file: {fe}")
                    
                    # Send to all connected WebSocket clients
                    clients = state['clients']
                    if clients:
                        message = json.dumps({
                            "type": "serial_data",
                            "line": line,
                            "ts": int(time.time() * 1000)
                        })
                        
                        # Send to all clients, remove disconnected ones
                        disconnected = set()
                        for client in clients:
                            try:
                                await client.send(message)
                            except websockets.exceptions.ConnectionClosed:
                                disconnected.add(client)
                        
                        for c in disconnected:
                            clients.discard(c)
                        
                        lines_sent += 1
                        
                        if lines_sent == 1:
                            print(f"[OK] First data sent to {len(clients)} client(s): {line[:80]}")
                        elif lines_sent % 500 == 0:
                            print(f"[Info] {lines_sent} lines sent to {len(clients)} client(s)")
            
            else:
                # No data available, sleep briefly
                await asyncio.sleep(0.01)
                
        except serial.SerialException as e:
            print(f"[ERROR] Serial read error: {e}")
            print("[Info] Detector may have been disconnected. Waiting...")
            await asyncio.sleep(2)
        except Exception as e:
            print(f"[ERROR] Unexpected error in reader: {e}")
            await asyncio.sleep(0.5)


async def ws_handler(websocket):
    """Handle a single WebSocket connection from the browser."""
    client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}" if hasattr(websocket, 'remote_address') and websocket.remote_address else "unknown"
    print(f"[OK] Browser connected: {client_info}")
    state['clients'].add(websocket)
    
    sp = state['serial']
    # Send welcome message with bridge info
    welcome = json.dumps({
        "type": "bridge_info",
        "version": BRIDGE_VERSION,
        "serial_port": sp.port if sp else "unknown",
        "baud_rate": BAUD_RATE,
        "os": platform.system(),
        "message": "MuNRa Serial Bridge connected"
    })
    
    try:
        await websocket.send(welcome)
        
        # Listen for commands from the browser (e.g., disconnect request)
        async for message in websocket:
            try:
                cmd = json.loads(message)
                if cmd.get("type") == "ping":
                    await websocket.send(json.dumps({"type": "pong", "ts": int(time.time() * 1000)}))
                elif cmd.get("type") == "status":
                    await websocket.send(json.dumps({
                        "type": "status",
                        "serial_connected": sp is not None and sp.is_open,
                        "clients": len(state['clients']),
                        "serial_port": sp.port if sp else None
                    }))
            except json.JSONDecodeError:
                pass
    
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        state['clients'].discard(websocket)
        print(f"[Info] Browser disconnected: {client_info}")


async def main():
    # ── Parse arguments ────────────────────────────────────────────
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    
    if '--no-save' in flags:
        state['save_locally'] = False
    if '--help' in flags or '-h' in flags:
        print(__doc__)
        sys.exit(0)
    
    print_banner()
    
    # ── Determine serial port ──────────────────────────────────────
    port_path = None
    
    if args:
        port_path = args[0]
        print(f"[Info] Using specified port: {port_path}")
    else:
        # Auto-detect
        ports = detect_serial_ports()
        if not ports:
            print("[ERROR] No serial ports found!")
            print()
            print("  Troubleshooting:")
            print("  1. Check the USB cable is connected")
            print("  2. Try a different USB port")
            if platform.system() == "Linux":
                print("  3. Check: ls -la /dev/ttyACM* /dev/ttyUSB*")
                print("  4. Check kernel log: dmesg | tail -20")
            elif platform.system() == "Windows":
                print("  3. Open Device Manager > Ports (COM & LPT)")
            elif platform.system() == "Darwin":
                print("  3. Check: ls /dev/tty.usb*")
            print()
            sys.exit(1)
        
        print(f"[Info] Found {len(ports)} serial port(s):")
        for i, p in enumerate(ports):
            marker = " <-- best match" if i == 0 else ""
            print(f"  [{i+1}] {p['device']}  —  {p['description']}{marker}")
        
        if len(ports) == 1:
            port_path = ports[0]["device"]
            print(f"\n[Info] Auto-selecting: {port_path}")
        else:
            # Let user choose
            print()
            while True:
                try:
                    choice = input(f"Select port [1-{len(ports)}] (default: 1): ").strip()
                    if not choice:
                        choice = "1"
                    idx = int(choice) - 1
                    if 0 <= idx < len(ports):
                        port_path = ports[idx]["device"]
                        break
                    else:
                        print(f"  Please enter a number between 1 and {len(ports)}")
                except (ValueError, EOFError):
                    port_path = ports[0]["device"]
                    break
    
    # ── Open serial port ───────────────────────────────────────────
    if not open_serial(port_path):
        sys.exit(1)
    
    # ── Open local data file ───────────────────────────────────────
    if state['save_locally']:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        fpath = f"munra_data_{ts}.csv"
        try:
            f = open(fpath, "w", encoding="utf-8")
            f.write(f"# MuNRa Detector Data — {datetime.now().isoformat()}\n")
            f.write(f"# Serial port: {port_path} at {BAUD_RATE} baud\n")
            f.write(f"# Format: timestamp<TAB>raw_line\n")
            f.write(f"# (This file replaces minicom — all data is saved here)\n")
            f.flush()
            state['data_file'] = f
            state['data_file_path'] = fpath
            print(f"[OK] Local data file: {os.path.abspath(fpath)}")
        except Exception as e:
            print(f"[Warning] Could not create data file: {e}")
            print("[Info] Data will still be forwarded via WebSocket.")
    else:
        print("[Info] Local data saving disabled (--no-save)")
    
    # ── Start WebSocket server ─────────────────────────────────────
    print(f"\n[OK] Starting WebSocket server on ws://{WS_HOST}:{WS_PORT}")
    print("[Info] Open MuNRa in ANY browser and click 'Connect'")
    print("[Info] Press Ctrl+C to stop\n")
    
    if state['data_file']:
        print("─" * 60)
        print("  DATA IS BEING SAVED LOCALLY (no need for minicom)")
        print(f"  File: {os.path.abspath(state['data_file_path'])}")
        print("─" * 60)
        print()
    
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        print("\n[Info] Shutting down...")
        state['running'] = False
    
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)
    
    # Start WebSocket server and serial reader concurrently
    try:
        async with serve(ws_handler, WS_HOST, WS_PORT) as server:
            print(f"[OK] WebSocket server listening on ws://{WS_HOST}:{WS_PORT}")
            # Run the serial reader in parallel
            await serial_reader()
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"\n[ERROR] Port {WS_PORT} is already in use!")
            print("  Another instance of the bridge may be running.")
            print(f"  Kill it:  lsof -ti :{WS_PORT} | xargs kill")
        else:
            print(f"\n[ERROR] Could not start WebSocket server: {e}")
        sys.exit(1)
    finally:
        if state['data_file']:
            try:
                state['data_file'].write(f"# Session ended: {datetime.now().isoformat()}\n")
                state['data_file'].close()
                print(f"[OK] Data saved to: {os.path.abspath(state['data_file_path'])}")
            except Exception:
                pass
        sp = state['serial']
        if sp and sp.is_open:
            sp.close()
            print("[OK] Serial port closed.")
        print("[OK] Bridge stopped.")


if __name__ == "__main__":
    asyncio.run(main())
