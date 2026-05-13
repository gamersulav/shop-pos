// BLE thermal printer — Deli S441, TSPL protocol

const SERVICES = [
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
];

let _device = null;
let _char   = null;

export const isConnected = () => !!(_device?.gatt?.connected && _char);
export const deviceName  = () => _device?.name ?? null;

export async function connect() {
  if (typeof navigator === 'undefined' || !navigator.bluetooth)
    throw new Error('Web Bluetooth not supported. Use Chrome or Edge on Android.');

  _device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });
  _device.addEventListener('gattserverdisconnected', () => { _char = null; });

  const server = await _device.gatt.connect();
  let allSvcs = [];
  try { allSvcs = await server.getPrimaryServices(); } catch {}

  const known  = new Set(SERVICES);
  const extras = allSvcs.map(s => s.uuid).filter(u => !known.has(u));

  for (const uuid of [...SERVICES, ...extras]) {
    try {
      const svc   = await server.getPrimaryService(uuid);
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          _char = c; break;
        }
      }
      if (_char) break;
    } catch {}
  }

  if (!_char) {
    const found = allSvcs.map(s => s.uuid);
    throw new Error(`No writable characteristic found.${found.length ? '\nServices: ' + found.join(', ') : ''}`);
  }
  return _device.name;
}

export function disconnect() {
  _device?.gatt?.disconnect();
  _device = null; _char = null;
}

async function send(bytes) {
  if (!_char) throw new Error('Printer not connected.');
  const MTU = 182;
  for (let i = 0; i < bytes.length; i += MTU) {
    const chunk = bytes.slice(i, i + MTU);
    if (_char.properties.writeWithoutResponse) await _char.writeValueWithoutResponse(chunk);
    else                                        await _char.writeValue(chunk);
    if (i + MTU < bytes.length) await new Promise(r => setTimeout(r, 10));
  }
}

const ms = n => new Promise(r => setTimeout(r, n));

// ── Barcode helpers ───────────────────────────────────────────────────────────
export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

// Strip characters that would break TSPL quoted strings
function ts(s) { return String(s ?? '').replace(/[\r\n"]/g, ' ').trim(); }

// ── TSPL sender ───────────────────────────────────────────────────────────────
const SETUP =
  'SIZE 48 mm,30 mm\r\n' +
  'GAP 3 mm,0 mm\r\n' +
  'DENSITY 15\r\n' +
  'CLS\r\n';

async function tsplPrint(lines) {
  const payload = SETUP + lines.join('\r\n') + '\r\nPRINT 1,1\r\n';
  await send(new TextEncoder().encode(payload));
  await ms(500);
}

const SHOP = 'UniverCell';

// ── Product label 48×30mm ─────────────────────────────────────────────────────
export async function printProductLabel(product) {
  const code  = productCode(product.id);
  const name  = ts(product.name).substring(0, 26);
  const price = `Rs ${Number(product.selling_price).toFixed(0)}`;
  await tsplPrint([
    `TEXT 10,5,"3",0,1,1,"${name}"`,
    `TEXT 10,35,"4",0,1,1,"${price}"`,
    `BARCODE 10,75,"128",60,1,0,2,2,"${code}"`,
  ]);
}

// ── Phone label 48×30mm ───────────────────────────────────────────────────────
export async function printPhoneLabel(phone) {
  const code  = phoneCode(phone.id);
  const model = ts(phone.model).substring(0, 26);
  const info  = `${ts(phone.condition)}  Rs ${Number(phone.selling_price).toFixed(0)}`;
  await tsplPrint([
    `TEXT 10,5,"3",0,1,1,"${model}"`,
    `TEXT 10,35,"2",0,1,1,"${info.substring(0, 32)}"`,
    `BARCODE 10,65,"128",60,1,0,2,2,"${code}"`,
  ]);
}

// ── Sale receipt (48×30mm, up to 6 items) ────────────────────────────────────
export async function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const lines = [];
  let y = 5;

  // Shop name — font3 = ~16px/char; "UniverCell"=10 chars → 160px; center ≈ (384-160)/2 = 112
  lines.push(`TEXT 112,${y},"3",0,1,1,"${SHOP}"`);  y += 24;

  // Date/time
  lines.push(`TEXT 0,${y},"1",0,1,1,"${ts(now)}"`);  y += 13;

  // Divider
  lines.push(`LINE 0,${y},383,${y},1`);  y += 5;

  // Items
  const visible  = items.slice(0, 6);
  const overflow = items.length - 6;

  for (const item of visible) {
    const qty   = Number(item.qty ?? 1);
    const net   = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    const left  = `x${qty} ${ts(item.name)}`.substring(0, 28);
    const right = `Rs${net.toFixed(0)}`;
    // font1 = 8px/char; right-align price
    const rx = Math.max(200, 384 - right.length * 8);
    lines.push(`TEXT 0,${y},"1",0,1,1,"${left}"`);
    lines.push(`TEXT ${rx},${y},"1",0,1,1,"${right}"`);
    y += 13;
  }

  if (overflow > 0) { lines.push(`TEXT 0,${y},"1",0,1,1,"+${overflow} more"`);  y += 13; }

  // Divider
  lines.push(`LINE 0,${y},383,${y},1`);  y += 5;

  // Total — font3 = ~16px/char; right-align
  const totalStr = `Rs ${Number(total).toFixed(0)}`;
  const tx = Math.max(190, 384 - totalStr.length * 16);
  lines.push(`TEXT 0,${y},"3",0,1,1,"TOTAL"`);
  lines.push(`TEXT ${tx},${y},"3",0,1,1,"${totalStr}"`);
  y += 25;

  // Payment + bill number
  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit-${ts(creditCustomer).substring(0, 12)}`
    : ts(payment);
  lines.push(`TEXT 0,${y},"1",0,1,1,"Pay:${payLabel}  #${id}  Thank you!"`);

  await tsplPrint(lines);
}
