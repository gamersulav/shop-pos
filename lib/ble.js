// Web Bluetooth driver for BLE thermal printers (Deli S441 and similar)
// Tries multiple common service UUIDs since Chinese thermal printers vary

const SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',  // most common 58mm Chinese thermal
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',  // Nordic UART Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // Microchip SerialPortService
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // another common variant
];

let _device = null;
let _char   = null;

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
  throw new Error('Could not find a writable characteristic.\nMake sure the printer is on and nearby.');
}

export async function connect() {
  if (!isSupported()) {
    throw new Error('Web Bluetooth is not available.\nUse Chrome on Android (not Firefox or Samsung Browser).');
  }
  _device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });
  _device.addEventListener('gattserverdisconnected', () => { _char = null; });
  const gatt = await _device.gatt.connect();
  _char = await findWritable(gatt);
  return _device.name || 'Printer';
}

export function disconnect() {
  try { _device?.gatt.disconnect(); } catch {}
  _device = null;
  _char   = null;
}

async function ensureConnected() {
  if (!_device) throw new Error('No printer connected.');
  if (!_device.gatt.connected || !_char) {
    const gatt = await _device.gatt.connect();
    _char = await findWritable(gatt);
  }
}

// Send raw ESC/POS bytes to printer, chunked to stay within BLE MTU limit
export async function send(bytes) {
  await ensureConnected();
  const CHUNK = 512;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    if (_char.properties.writeWithoutResponse) {
      await _char.writeValueWithoutResponse(chunk);
    } else {
      await _char.writeValue(chunk);
    }
    if (i + CHUNK < bytes.length) await new Promise(r => setTimeout(r, 30));
  }
}
