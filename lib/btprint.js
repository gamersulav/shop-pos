// Bluetooth Classic printer driver — only works inside the Capacitor Android APK.
// Call isAvailable() before using anything else.

export function isAvailable() {
  if (typeof window === 'undefined') return false;
  return !!window.Capacitor?.isNativePlatform?.();
}

async function plugin() {
  const mod = await import('bluetooth-serial');
  return mod.BluetoothSerial;
}

export async function requestPermissions() {
  const p = await plugin();
  await p.requestPermissions({ permissions: ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT'] });
}

export async function listPaired() {
  const p = await plugin();
  const { devices } = await p.list();
  return devices || [];
}

export async function connect(address) {
  const p = await plugin();
  await p.connect({ address });
}

export async function disconnect() {
  try { const p = await plugin(); await p.disconnect(); } catch {}
}

// ── ESC/POS receipt builder (text mode, 32 chars wide for 58 mm) ─────────────

const ESC = 0x1B, GS = 0x1D;

function t(text) { return new TextEncoder().encode(text); }
function b(...vals) { return new Uint8Array(vals); }
function lpad(s, n) { s = String(s); return s.length >= n ? s.slice(-n) : ' '.repeat(n - s.length) + s; }
function rpad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

function merge(parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function buildReceipt({ items, total, payment, discount, shopName }) {
  const shop = shopName || 'UNIVERCELL';
  const line = '--------------------------------\n';
  const parts = [
    b(ESC, 0x40),                          // init
    b(ESC, 0x61, 0x01), b(ESC, 0x45, 0x01), t(shop + '\n'), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), t('Mobile Accessories & Repair\n'),
    t(line),
    b(ESC, 0x61, 0x00),                    // left align
  ];

  for (const it of items) {
    const name  = rpad(it.name, 18);
    const qty   = lpad(`x${it.qty}`, 3);
    const price = lpad(`${Math.round(it.price * it.qty)}`, 9);
    parts.push(t(`${name}${qty}${price}\n`));
  }

  parts.push(t(line));

  if (discount && discount > 0) {
    parts.push(b(ESC, 0x61, 0x02), t(`Discount: -Rs ${Math.round(discount)}\n`));
  }

  parts.push(
    b(ESC, 0x61, 0x02), b(ESC, 0x45, 0x01),
    t(`TOTAL: Rs ${Math.round(total)}\n`),
    b(ESC, 0x45, 0x00),
  );

  if (payment) {
    parts.push(b(ESC, 0x61, 0x02), t(`Payment: ${payment}\n`));
  }

  parts.push(
    b(ESC, 0x61, 0x01),
    t('\nThank you!\n\n\n'),
    b(GS, 0x56, 0x42, 0x00),              // partial cut
  );

  return merge(parts);
}

async function send(bytes) {
  const p = await plugin();
  const data = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  await p.write({ data });
}

export async function printReceipt(saleData) {
  await send(buildReceipt(saleData));
}

// ── Label builders ───────────────────────────────────────────────────────────

function barcode128Cmd(text) {
  const data = new TextEncoder().encode(text);
  return new Uint8Array([
    0x1D, 0x68, 0x50,           // GS h 80 — barcode height 80 dots
    0x1D, 0x77, 0x02,           // GS w 2  — narrow modules
    0x1D, 0x48, 0x02,           // GS H 2  — HRI below barcode
    0x1D, 0x6B, 0x49,           // GS k Code128
    data.length, ...data,
  ]);
}

function buildProductLabel({ id, name, selling_price, shopName }) {
  const shop = shopName || 'UNIVERCELL';
  const code = `P${id}`;
  return merge([
    b(ESC, 0x40),
    b(ESC, 0x61, 0x01), b(ESC, 0x45, 0x01), t(shop + '\n'), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), t(name + '\n'),
    b(ESC, 0x45, 0x01), t(`Rs ${selling_price}\n`), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), barcode128Cmd(code),
    t('\n\n'),
    b(GS, 0x56, 0x42, 0x00),
  ]);
}

function buildPhoneLabel({ id, model, selling_price, condition, shopName }) {
  const shop = shopName || 'UNIVERCELL';
  const code = `PH${id}`;
  return merge([
    b(ESC, 0x40),
    b(ESC, 0x61, 0x01), b(ESC, 0x45, 0x01), t(shop + '\n'), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), t(model + '\n'),
    condition ? t(condition + '\n') : new Uint8Array(0),
    b(ESC, 0x45, 0x01), t(`Rs ${Number(selling_price).toLocaleString()}\n`), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), barcode128Cmd(code),
    t('\n\n'),
    b(GS, 0x56, 0x42, 0x00),
  ]);
}

export async function printProductLabel(product) {
  await send(buildProductLabel(product));
}

export async function printPhoneLabel(phone) {
  await send(buildPhoneLabel(phone));
}
