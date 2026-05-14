// Web Bluetooth driver for BLE thermal printers (Deli S441 and similar)
// ff00/ff02 = LuckPrinter/Deli raster protocol (confirmed working)

const SERVICES = [
  '0000ff00-0000-1000-8000-00805f9b34fb',  // LuckPrinter / Deli ff02 write — try first
  '0000ffe0-0000-1000-8000-00805f9b34fb',  // HM-10 BLE UART fallback
  '000018f0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',  // Nordic UART
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

let _device       = null;
let _char         = null;
let _onDisconnect = null;
let _writeQ       = Promise.resolve(); // serialises all BLE writes

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
  for (const uuid of SERVICES) {
    try {
      const svc   = await gatt.getPrimaryService(uuid);
      const chars = await svc.getCharacteristics();
      const w     = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
      if (w) return w;
    } catch {}
  }
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
  _writeQ = Promise.resolve();
}

// Call before starting a new print job to clear any failed state from the previous one
export function resetQueue() {
  _writeQ = Promise.resolve();
}

async function ensureConnected() {
  if (!_device) throw new Error('No printer connected. Tap "🖨 Connect" first.');
  if (!_device.gatt.connected || !_char) {
    const gatt = await _device.gatt.connect();
    _char = await findWritable(gatt);
  }
}

// Queue one chunk write — chains onto _writeQ so writes never overlap.
// Chrome throws "GATT operation already in progress" if two writes race.
function _enqueueChunk(chunk) {
  const p = _writeQ.then(async () => {
    if (_char.properties.write) {
      await _char.writeValue(chunk);
    } else {
      await _char.writeValueWithoutResponse(chunk);
    }
    await new Promise(r => setTimeout(r, 50));
  });
  _writeQ = p.catch(() => {}); // keep queue alive even if this chunk errors
  return p;                    // but let the caller see the error
}

// 100-byte chunks, serialised through _writeQ
export async function send(bytes) {
  await ensureConnected();
  const CHUNK = 100;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    await _enqueueChunk(bytes.slice(i, i + CHUNK));
  }
}
