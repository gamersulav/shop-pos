// Web Bluetooth driver for BLE thermal printers (Deli S441 and similar)
// Tries multiple common service UUIDs + full service enumeration as fallback

const SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',  // HM-10 BLE UART (most common cheap Chinese thermal)
  '000018f0-0000-1000-8000-00805f9b34fb',  // common 58mm ESC/POS BLE
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',  // Nordic UART Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // Microchip SerialPortService
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // NIIMBOT / Deli label variant
  '0000ff00-0000-1000-8000-00805f9b34fb',  // another generic custom service
];

let _device        = null;
let _char          = null;
let _onDisconnect  = null; // callback → updates React state in staff.js

export function isSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export function isConnected() {
  return !!(_device && _device.gatt.connected && _char);
}

export function deviceName() {
  return _device?.name || null;
}

async function findWritable(gatt) {
  // Pass 1: try each known service UUID
  for (const uuid of SERVICES) {
    try {
      const svc   = await gatt.getPrimaryService(uuid);
      const chars = await svc.getCharacteristics();
      const w     = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
      if (w) return w;
    } catch {}
  }

  // Pass 2: enumerate ALL services the browser granted access to
  try {
    const svcs = await gatt.getPrimaryServices();
    for (const svc of svcs) {
      try {
        const chars = await svc.getCharacteristics();
        const w     = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
        if (w) return w;
      } catch {}
    }
  } catch {}

  throw new Error(
    'Connected to device but could not find a writable channel.\n' +
    'Make sure the printer is powered on, then try again.'
  );
}

// onDisconnect: called when the printer turns off / goes out of range
export async function connect(onDisconnect) {
  if (!isSupported()) {
    throw new Error(
      'Web Bluetooth not available.\n' +
      'Open this page in Chrome on Android (not Firefox or Samsung Browser).'
    );
  }

  _device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });

  _onDisconnect = onDisconnect || null;
  _device.addEventListener('gattserverdisconnected', () => {
    _char = null;
    _onDisconnect?.();
  });

  const gatt = await _device.gatt.connect();
  _char = await findWritable(gatt);
  return _device.name || 'Printer';
}

export function disconnect() {
  try { _device?.gatt.disconnect(); } catch {}
  _device = null;
  _char   = null;
  _onDisconnect = null;
}

async function ensureConnected() {
  if (!_device) throw new Error('No printer connected. Tap "🖨 Connect" first.');
  if (!_device.gatt.connected || !_char) {
    const gatt = await _device.gatt.connect();
    _char = await findWritable(gatt);
  }
}

// Send raw bytes in 20-byte chunks — BLE default MTU is 20 bytes.
// Larger chunks are silently dropped or cause write failures on most printers.
export async function send(bytes) {
  await ensureConnected();
  const CHUNK = 20;
  const useNoResponse = !!_char.properties.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    if (useNoResponse) {
      await _char.writeValueWithoutResponse(chunk);
    } else {
      await _char.writeValue(chunk);
    }
    await new Promise(r => setTimeout(r, 50)); // give printer time between every chunk
  }
}
