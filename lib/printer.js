// Thermal printer — Deli S441 (58mm BLE)
// Primary: Web Bluetooth + ESC/POS (no dialog, prints instantly)
// Fallback: in-page window.print() if Bluetooth not connected

import * as BLE from './ble';

export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

// Re-export BLE helpers so staff.js only imports from printer
export const bleSupported  = BLE.isSupported;
export const bleConnected  = BLE.isConnected;
export const bleDeviceName = BLE.deviceName;
export const bleConnect    = BLE.connect;
export const bleDisconnect = BLE.disconnect;

// ── ESC/POS builder ───────────────────────────────────────────────────────────
// 58mm paper ≈ 32 chars per line at standard Font A
const W = 32;

function ep(...init) {
  const b = [...init];
  return {
    push: (...v) => { b.push(...v); },
    init()    { b.push(0x1B, 0x40); return this; },
    align(a)  { b.push(0x1B, 0x61, a); return this; },      // 0=L 1=C 2=R
    bold(on)  { b.push(0x1B, 0x45, on ? 1 : 0); return this; },
    size(n)   { b.push(0x1D, 0x21, n); return this; },       // 0x00=normal 0x11=double
    lf(n = 1) { for (let i = 0; i < n; i++) b.push(0x0A); return this; },
    feed(n)   { b.push(0x1B, 0x64, n); return this; },
    cut()     { b.push(0x1D, 0x56, 0x42, 0x00); return this; },
    text(s)   {
      for (const c of String(s ?? '')) {
        const code = c.charCodeAt(0);
        b.push(code < 256 ? code : 0x3F); // ? for non-Latin chars
      }
      return this;
    },
    line(s) { return this.text(String(s).slice(0, W)).lf(); },
    dash()  { return this.text('-'.repeat(W)).lf(); },
    // Two-column row: left text + right-aligned value
    row(left, right) {
      const r = String(right);
      const l = String(left).slice(0, W - r.length - 1);
      const sp = Math.max(1, W - l.length - r.length);
      return this.text(l + ' '.repeat(sp) + r).lf();
    },
    // CODE128 barcode via GS k (new-style, type 73=0x49)
    // Data prefix: {B = 0x7B 0x42 (code set B, printable ASCII)
    barcode(code, height = 50) {
      const data = [0x7B, 0x42, ...code.split('').map(c => c.charCodeAt(0))];
      b.push(
        0x1D, 0x68, height,   // GS h — bar height in dots
        0x1D, 0x77, 0x02,     // GS w — bar width multiplier ×2
        0x1D, 0x48, 0x02,     // GS H — HRI text below barcode
        0x1D, 0x66, 0x00,     // GS f — HRI font A
        0x1D, 0x6B, 0x49, data.length, ...data,  // GS k CODE128
      );
      return this;
    },
    bytes() { return new Uint8Array(b); },
  };
}

// ── HTML fallback (in-page print, no popup) ───────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

async function makeBarcodeImg(code) {
  try {
    const JsBarcode = (await import('jsbarcode')).default;
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, code, {
      format: 'CODE128', width: 2, height: 52,
      displayValue: true, fontSize: 13, margin: 6,
      background: '#ffffff', lineColor: '#000000',
    });
    return `<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:auto;display:block;" />`;
  } catch {
    return `<div style="font-size:11pt;font-weight:bold;letter-spacing:3px;text-align:center;padding:3mm 0;">${esc(code)}</div>`;
  }
}

function printInPage(bodyHtml) {
  const ID = '__tp__', SID = '__tp_s__';
  document.getElementById(ID)?.remove();
  document.getElementById(SID)?.remove();

  const div = document.createElement('div');
  div.id = ID;
  div.style.display = 'none';
  div.innerHTML = bodyHtml;
  document.body.appendChild(div);

  const style = document.createElement('style');
  style.id = SID;
  style.textContent = `
    @media print {
      @page { size: 58mm auto; margin: 0; }
      body > *:not(#${ID}) { display: none !important; }
      #${ID} { display: block !important; width: 58mm; font-family: Arial,Helvetica,sans-serif;
                color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #${ID} * { box-sizing: border-box; }
      #${ID} table { width: 100%; border-collapse: collapse; }
      #${ID} hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
    }
  `;
  document.head.appendChild(style);

  function cleanup() { div.remove(); style.remove(); }
  setTimeout(() => {
    window.print();
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 4000);
  }, 250);
}

// ── Product label ─────────────────────────────────────────────────────────────
export async function printProductLabel(product) {
  const code  = productCode(product.id);
  const price = `Rs ${Number(product.selling_price ?? 0).toFixed(0)}`;

  if (BLE.isConnected()) {
    const b = ep().init()
      .align(1).bold(true).line(product.name).bold(false)
      .size(0x11).line(price).size(0x00)
      .barcode(code)
      .lf().feed(3).cut();
    await BLE.send(b.bytes());
    return;
  }

  // Fallback — window.print()
  const bc = await makeBarcodeImg(code);
  printInPage(`
    <div style="padding:3mm;text-align:center;">
      <div style="font-size:11pt;font-weight:bold;line-height:1.3;margin-bottom:2mm;">${esc(product.name)}</div>
      <div style="font-size:17pt;font-weight:bold;margin-bottom:3mm;">${esc(price)}</div>
      ${bc}
    </div>
  `);
}

// ── Phone label ───────────────────────────────────────────────────────────────
export async function printPhoneLabel(phone) {
  const code  = phoneCode(phone.id);
  const price = `Rs ${Number(phone.selling_price ?? 0).toFixed(0)}`;
  const sub   = [phone.storage, phone.condition].filter(Boolean).join(' / ');

  if (BLE.isConnected()) {
    const b = ep().init().align(1)
      .bold(true).line(phone.model).bold(false);
    if (sub) b.line(sub);
    b.size(0x11).line(price).size(0x00)
      .barcode(code)
      .lf().feed(3).cut();
    await BLE.send(b.bytes());
    return;
  }

  const bc = await makeBarcodeImg(code);
  printInPage(`
    <div style="padding:3mm;text-align:center;">
      <div style="font-size:11pt;font-weight:bold;line-height:1.3;margin-bottom:1mm;">${esc(phone.model)}</div>
      ${sub ? `<div style="font-size:9pt;color:#333;margin-bottom:2mm;">${esc(sub)}</div>` : ''}
      <div style="font-size:17pt;font-weight:bold;margin-bottom:3mm;">${esc(price)}</div>
      ${bc}
    </div>
  `);
}

// ── Sale receipt ──────────────────────────────────────────────────────────────
const SHOP = 'UniverCell';

export function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit-${creditCustomer}`.slice(0, W)
    : payment;

  if (BLE.isConnected()) {
    const b = ep().init()
      .align(1).bold(true).size(0x00).line(SHOP).bold(false)
      .line(now).align(0).dash();

    for (const item of items) {
      const qty = Number(item.qty ?? 1);
      const net = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
      b.row(`x${qty} ${item.name}`, `Rs${net.toFixed(0)}`);
    }

    b.dash()
      .bold(true).size(0x11).row('TOTAL', `Rs${Number(total).toFixed(0)}`).size(0x00).bold(false)
      .line(`Pay: ${payLabel}`)
      .line(`#${id}`)
      .align(1).line('Thank you!')
      .feed(4).cut();

    BLE.send(b.bytes()).catch(console.error);
    return;
  }

  // Fallback — window.print()
  const escH = s => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const payLabelH = payment === 'Credit' && creditCustomer
    ? `Credit — ${escH(creditCustomer)}`
    : escH(payment);
  const rows = items.map(item => {
    const qty = Number(item.qty ?? 1);
    const net = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    return `<tr>
      <td style="padding:1.5mm 0;font-size:9pt;vertical-align:top;">\xD7${qty} ${escH(item.name)}</td>
      <td style="padding:1.5mm 0 1.5mm 2mm;font-size:9pt;text-align:right;vertical-align:top;white-space:nowrap;">Rs ${net.toFixed(0)}</td>
    </tr>`;
  }).join('');

  printInPage(`
    <div style="padding:3mm;">
      <div style="text-align:center;font-size:14pt;font-weight:bold;margin-bottom:1mm;">${escH(SHOP)}</div>
      <div style="text-align:center;font-size:8pt;color:#555;margin-bottom:2mm;">${escH(now)}</div>
      <hr/>
      <table>${rows}</table>
      <hr/>
      <table><tr>
        <td style="font-size:12pt;font-weight:bold;">TOTAL</td>
        <td style="font-size:12pt;font-weight:bold;text-align:right;">Rs ${Number(total).toFixed(0)}</td>
      </tr></table>
      <div style="font-size:9pt;margin-top:2mm;">Pay: ${payLabelH}</div>
      <div style="font-size:8pt;color:#555;margin-top:1mm;">#${escH(String(id))}</div>
      <div style="text-align:center;font-size:9pt;margin-top:3mm;">Thank you!</div>
    </div>
  `);
}
