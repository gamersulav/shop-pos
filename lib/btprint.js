// Bluetooth Classic printer driver via native Java bridge (window.ShopBT).
// The bridge is registered with addJavascriptInterface before any JS runs,
// so it is synchronously available — no timing issues, works with any URL.

export function isAvailable() {
  if (typeof window === 'undefined') return false;
  return typeof window.ShopBT !== 'undefined';
}

// ── Callback registry ────────────────────────────────────────────────────────
// Java calls back into JS via  window._btCb(id, result, error).

let _cbSeq = 0;
function initCbRegistry() {
  if (typeof window === 'undefined') return;
  if (window._btCb) return;
  window._btCallbacks = {};
  window._btCb = function (id, result, error) {
    const fn = window._btCallbacks[id];
    if (!fn) return;
    delete window._btCallbacks[id];
    fn(result, error);
  };
}

function call(method, ...args) {
  return new Promise((resolve, reject) => {
    initCbRegistry();
    const id = String(++_cbSeq);
    window._btCallbacks[id] = (result, error) => {
      if (error) reject(new Error(error));
      else resolve(result);
    };
    window.ShopBT[method](...args, id);
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function requestPermissions() {
  return call('requestPermissions');
}

export async function listPaired() {
  const raw = window.ShopBT.listPaired();
  const parsed = JSON.parse(raw);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.devices || [];
}

export async function connect(address) {
  await call('connect', address);
}

export function disconnect() {
  try { window.ShopBT.disconnect(); } catch {}
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
    b(ESC, 0x40),
    b(ESC, 0x61, 0x01), b(ESC, 0x45, 0x01), t(shop + '\n'), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), t('Mobile Accessories & Repair\n'),
    t(line),
    b(ESC, 0x61, 0x00),
  ];
  for (const it of items) {
    const name  = rpad(it.name, 18);
    const qty   = lpad(`x${it.qty}`, 3);
    const price = lpad(`${Math.round(it.price * it.qty)}`, 9);
    parts.push(t(`${name}${qty}${price}\n`));
  }
  parts.push(t(line));
  if (discount && discount > 0)
    parts.push(b(ESC, 0x61, 0x02), t(`Discount: -Rs ${Math.round(discount)}\n`));
  parts.push(
    b(ESC, 0x61, 0x02), b(ESC, 0x45, 0x01),
    t(`TOTAL: Rs ${Math.round(total)}\n`),
    b(ESC, 0x45, 0x00),
  );
  if (payment)
    parts.push(b(ESC, 0x61, 0x02), t(`Payment: ${payment}\n`));
  parts.push(b(ESC, 0x61, 0x01), t('\nThank you!\n\n\n'), b(GS, 0x56, 0x42, 0x00));
  return merge(parts);
}

async function send(bytes) {
  const data = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  await call('write', data);
}

export async function printReceipt(saleData) {
  await send(buildReceipt(saleData));
}

// ── Label builders ───────────────────────────────────────────────────────────

function barcode128Cmd(text) {
  const data = new TextEncoder().encode(text);
  return new Uint8Array([
    0x1D, 0x68, 0x50, 0x1D, 0x77, 0x02, 0x1D, 0x48, 0x02,
    0x1D, 0x6B, 0x49, data.length, ...data,
  ]);
}

function buildProductLabel({ id, name, selling_price, shopName }) {
  const shop = shopName || 'UNIVERCELL';
  return merge([
    b(ESC, 0x40),
    b(ESC, 0x61, 0x01), b(ESC, 0x45, 0x01), t(shop + '\n'), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), t(name + '\n'),
    b(ESC, 0x45, 0x01), t(`Rs ${selling_price}\n`), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), barcode128Cmd(`P${id}`),
    t('\n\n'), b(GS, 0x56, 0x42, 0x00),
  ]);
}

function buildPhoneLabel({ id, model, selling_price, condition, shopName }) {
  const shop = shopName || 'UNIVERCELL';
  return merge([
    b(ESC, 0x40),
    b(ESC, 0x61, 0x01), b(ESC, 0x45, 0x01), t(shop + '\n'), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), t(model + '\n'),
    condition ? t(condition + '\n') : new Uint8Array(0),
    b(ESC, 0x45, 0x01), t(`Rs ${Number(selling_price).toLocaleString()}\n`), b(ESC, 0x45, 0x00),
    b(ESC, 0x61, 0x01), barcode128Cmd(`PH${id}`),
    t('\n\n'), b(GS, 0x56, 0x42, 0x00),
  ]);
}

export async function printProductLabel(product) { await send(buildProductLabel(product)); }
export async function printPhoneLabel(phone)     { await send(buildPhoneLabel(phone)); }
