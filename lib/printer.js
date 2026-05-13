// BLE thermal printer module — Deli S441 via TSPL (browser-only, never runs on server)

const SERVICES = [
  '0000ff00-0000-1000-8000-00805f9b34fb',  // Common Chinese thermal printers
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // HPRT
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // Microchip BM70
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',  // Nordic UART
];

let _device = null;
let _char   = null;

export const isConnected = () => !!(_device?.gatt?.connected && _char);
export const deviceName  = () => _device?.name ?? null;

export async function connect() {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Web Bluetooth is not supported. Use Chrome or Edge on Android.');
  }
  _device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });
  _device.addEventListener('gattserverdisconnected', () => { _char = null; });

  const server = await _device.gatt.connect();

  for (const uuid of SERVICES) {
    try {
      const svc   = await server.getPrimaryService(uuid);
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          _char = c;
          break;
        }
      }
      if (_char) break;
    } catch {}
  }

  if (!_char) throw new Error('No writable characteristic found — printer may not be supported.');
  return _device.name;
}

export function disconnect() {
  _device?.gatt?.disconnect();
  _device = null;
  _char   = null;
}

async function send(tspl) {
  if (!_char) throw new Error('Printer not connected.');
  const bytes = new TextEncoder().encode(tspl);
  const MTU   = 512;
  for (let i = 0; i < bytes.length; i += MTU) {
    const chunk = bytes.slice(i, i + MTU);
    if (_char.properties.writeWithoutResponse) await _char.writeValueWithoutResponse(chunk);
    else                                        await _char.writeValue(chunk);
    if (i + MTU < bytes.length) await new Promise(r => setTimeout(r, 20));
  }
}

function safe(s) {
  return String(s ?? '').replace(/"/g, "'").replace(/[\r\n]/g, ' ');
}

function hdr(h = 30) {
  return `SIZE 48 mm, ${h} mm\r\nGAP 2 mm, 0 mm\r\nDIRECTION 0\r\nDENSITY 10\r\nSPEED 4\r\nCLS\r\n`;
}

// ── Barcode helpers ────────────────────────────────────────────────────────────
// Products: P00001  |  Phones: PH0001
export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

// ── Product label 48×30mm ─────────────────────────────────────────────────────
export async function printProductLabel(product) {
  const code  = productCode(product.id);
  const name  = safe(product.name).substring(0, 26);
  const price = `Rs ${Number(product.selling_price).toFixed(0)}`;

  const tspl = [
    hdr(),
    `BARCODE 10,5,"CODE128",55,0,0,2,2,"${code}"`,
    `TEXT 5,65,"2",0,1,1,"${name}"`,
    `TEXT 5,87,"2",0,1,1,"${price}"`,
    `PRINT 1`,
    '',
  ].join('\r\n');

  await send(tspl);
}

// ── Phone label 48×30mm ───────────────────────────────────────────────────────
export async function printPhoneLabel(phone) {
  const code  = phoneCode(phone.id);
  const model = safe(phone.model).substring(0, 24);
  const price = `Rs ${Number(phone.selling_price).toFixed(0)}`;
  const cond  = safe(phone.condition).substring(0, 10);

  const tspl = [
    hdr(),
    `BARCODE 10,5,"CODE128",55,0,0,2,2,"${code}"`,
    `TEXT 5,65,"2",0,1,1,"${model}"`,
    `TEXT 5,87,"2",0,1,1,"${cond} · ${price}"`,
    `PRINT 1`,
    '',
  ].join('\r\n');

  await send(tspl);
}

// ── Sale receipt — fits on one 48×30mm label (up to 10 items) ─────────────────
const SHOP = 'UniverCell';

export async function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  // Dot budget at 203 DPI (≈8 dots/mm): 48×30mm = 384×240 dots
  // Header: shopName(22) + date(14) + divider(3) = 39
  // Footer: divider(3) + total(22) + payment(14) + billno(14) = 53
  // Per item (font "1" = 14 dots): (240 - 39 - 53) / 14 = 10.57 → max 10 items

  const MAX    = 10;
  const visible  = items.slice(0, MAX);
  const overflow = items.length - MAX;

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const lines = [hdr()];
  let y = 2;

  // Shop name centered (font "2" = 12 dots/char)
  const sx = Math.max(5, Math.floor((384 - SHOP.length * 12) / 2));
  lines.push(`TEXT ${sx},${y},"2",0,1,1,"${SHOP}"`);
  y += 22;

  // Date/time
  lines.push(`TEXT 5,${y},"1",0,1,1,"${safe(now)}"`);
  y += 14;

  // Divider
  lines.push(`BAR 5,${y},374,2`);
  y += 3;

  // Items — font "1" = 8 dots/char → 46 chars across 374 dots
  for (const item of visible) {
    const qty  = Number(item.qty ?? 1);
    const net  = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    const right  = `x${qty} Rs${net.toFixed(0)}`;
    const avail  = 46 - right.length - 1;
    const left   = safe(item.name).substring(0, avail).padEnd(avail, ' ');
    lines.push(`TEXT 5,${y},"1",0,1,1,"${left} ${right}"`);
    y += 14;
  }

  if (overflow > 0) {
    lines.push(`TEXT 5,${y},"1",0,1,1,"  + ${overflow} more item${overflow > 1 ? 's' : ''}"`);
    y += 14;
  }

  // Divider
  lines.push(`BAR 5,${y},374,2`);
  y += 3;

  // Total
  lines.push(`TEXT 5,${y},"2",0,1,1,"TOTAL  Rs ${Number(total).toFixed(0)}"`);
  y += 22;

  // Payment
  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit - ${safe(creditCustomer).substring(0, 18)}`
    : safe(payment);
  lines.push(`TEXT 5,${y},"1",0,1,1,"Pay: ${payLabel}"`);
  y += 14;

  // Bill number + thank-you
  lines.push(`TEXT 5,${y},"1",0,1,1,"#${id}  Thank you!"`);

  lines.push(`PRINT 1`);
  lines.push('');

  await send(lines.join('\r\n'));
}
