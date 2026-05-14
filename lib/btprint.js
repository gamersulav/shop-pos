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

export async function printReceipt(saleData) {
  const p = await plugin();
  const bytes = buildReceipt(saleData);
  // Convert binary to latin-1 string for serial transmission
  const data = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  await p.write({ data });
}
