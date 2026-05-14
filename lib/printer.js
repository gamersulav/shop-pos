// Thermal printer — Deli S441 (58mm BLE) + window.print() fallback
// BLE path: renders content to a 384px-wide HTML5 canvas → 1-bit raster bitmap
// Protocol: LuckPrinter/Deli proprietary (enable wrapper + GS v 0 image data)
// This is NOT standard ESC/POS text mode — text commands are silently ignored.

import * as BLE from './ble';

export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

export const bleSupported  = BLE.isSupported;
export const bleConnected  = BLE.isConnected;
export const bleDeviceName = BLE.deviceName;
export const bleConnect    = BLE.connect;
export const bleDisconnect = BLE.disconnect;
export const bleResetQueue = BLE.resetQueue;
export const bleCharUUID   = BLE.charUUID;
export const bleGetAltChar = BLE.getAltChar;

// ── Raster protocol byte sequences ───────────────────────────────────────────
// Sourced from reverse-engineered LuckPrinter/C&Co thermal pocket printer protocol
const CMD_ENABLE      = new Uint8Array([0x10, 0xff, 0xf1, 0x03]);
const CMD_WAKE        = new Uint8Array(12);  // 12 null bytes
const CMD_DENSITY     = new Uint8Array([0x10, 0xff, 0x10, 0x00, 0x01]); // normal density
const CMD_LABEL_START = new Uint8Array([0x1f, 0x11, 0x51]);
const CMD_LABEL_POS   = new Uint8Array([0x1d, 0x0c]);
const CMD_LABEL_END   = new Uint8Array([0x1f, 0x11, 0x50]);
const CMD_FEED        = new Uint8Array([0x1b, 0x4a, 0x50]); // feed 80 dots
const CMD_STOP        = new Uint8Array([0x10, 0xff, 0xf1, 0x45]);

const PRINT_WIDTH = 384; // 48mm printable at 203 DPI

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Convert canvas to GS v 0 raster command (1-bit, MSB-first, dark pixel = 1)
function canvasToBitmapCmd(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const wb = Math.ceil(w / 8);
  const src = ctx.getImageData(0, 0, w, h).data;
  const bitmap = new Uint8Array(wb * h);
  for (let y = 0; y < h; y++) {
    for (let xb = 0; xb < wb; xb++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xb * 8 + bit;
        if (x < w) {
          const i = (y * w + x) * 4;
          const grey = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
          if (grey < 128) b |= (128 >> bit);
        }
      }
      bitmap[y * wb + xb] = b;
    }
  }
  const hdr = new Uint8Array([
    0x1d, 0x76, 0x30, 0x00,
    wb & 0xff, (wb >> 8) & 0xff,
    h  & 0xff, (h  >> 8) & 0xff,
  ]);
  const out = new Uint8Array(hdr.length + bitmap.length);
  out.set(hdr);
  out.set(bitmap, hdr.length);
  return out;
}

// Full print sequence with required delays between each command
async function rasterPrint(canvas) {
  BLE.resetQueue(); // clear any stuck state from a previous failed job
  await BLE.send(CMD_ENABLE);      await sleep(200);
  await BLE.send(CMD_WAKE);        await sleep(200);
  await BLE.send(CMD_DENSITY);     await sleep(100);
  await BLE.send(CMD_LABEL_START); await sleep(100);
  await BLE.send(canvasToBitmapCmd(canvas)); await sleep(800);
  await BLE.send(CMD_LABEL_POS);   await sleep(200);
  await BLE.send(CMD_LABEL_END);   await sleep(100);
  await BLE.send(CMD_FEED);        await sleep(1500);
  await BLE.send(CMD_STOP);
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function makeBarcodeCanvas(code) {
  const JsBarcode = (await import('jsbarcode')).default;
  const bc = document.createElement('canvas');
  JsBarcode(bc, code, {
    format: 'CODE128', width: 2, height: 60,
    displayValue: true, fontSize: 12, margin: 4,
    background: '#ffffff', lineColor: '#000000',
  });
  return bc;
}

// ── HTML fallback (window.print when BLE not connected) ───────────────────────
function esc(s) {
  return String(s ?? '').replace(/[<>&"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])
  );
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
      #${ID} {
        display: block !important; width: 58mm;
        font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
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

// ── Exhaustive protocol probe ─────────────────────────────────────────────────
// Tests EVERY known protocol variant + every service channel in one run (~25s).
// Watch the printer the whole time — tell us which number(s) printed.
//   1 = plain ASCII text on current char
//   2 = ESC/POS text on current char
//   3 = ESC/POS raster on current char (normal polarity)
//   4 = ESC/POS raster on current char (inverted polarity)
//   5 = LuckPrinter raster on current char
//   6 = AiYin raster on current char
//   7 = ESC/POS text on ffe1 (HM-10 UART) if present
//   8 = ESC/POS raster on ffe1 if present
export async function testPrint() {
  if (!BLE.isConnected()) throw new Error('Printer not connected.');
  const W = PRINT_WIDTH;
  const FEED = new Uint8Array([0x1b, 0x4a, 0x50]);
  const GAP  = 2500;

  // Render a number as a 384×60 bitmap (normal polarity: dark pixel = bit 1)
  function numBmp(n) {
    const c = document.createElement('canvas');
    c.width = W; c.height = 60;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 60);
    ctx.fillStyle = '#000'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.font = 'bold 48px Arial'; ctx.fillText(String(n), W / 2, 6);
    return canvasToBitmapCmd(c);
  }

  // Same but with all bitmap data bits XOR-flipped (inverted polarity)
  function numBmpInv(n) {
    const b = numBmp(n);
    const r = new Uint8Array(b);
    for (let i = 8; i < r.length; i++) r[i] ^= 0xff;
    return r;
  }

  // Write directly to any characteristic (used for alt-service probes)
  async function directSend(char, bytes) {
    const C = 100;
    for (let i = 0; i < bytes.length; i += C) {
      const chunk = bytes.slice(i, i + C);
      if (char.properties.write) await char.writeValue(chunk);
      else await char.writeValueWithoutResponse(chunk);
      await sleep(50);
    }
  }

  // ── Tests 1-6 on the currently-connected characteristic ──────────────────

  // 1: plain ASCII text, zero ESC/POS
  BLE.resetQueue();
  await BLE.send(new Uint8Array([0x31, 0x0a])); // "1\n"
  await BLE.send(FEED);
  await sleep(GAP);

  // 2: ESC @ init + text
  BLE.resetQueue();
  await BLE.send(new Uint8Array([0x1b, 0x40]));
  await sleep(100);
  await BLE.send(new Uint8Array([0x32, 0x0a])); // "2\n"
  await BLE.send(FEED);
  await sleep(GAP);

  // 3: ESC @ + GS v 0 raster, normal polarity (dark pixel = bit 1)
  BLE.resetQueue();
  await BLE.send(new Uint8Array([0x1b, 0x40]));
  await sleep(100);
  await BLE.send(numBmp(3));
  await sleep(500);
  await BLE.send(FEED);
  await sleep(GAP);

  // 4: same but inverted polarity (dark pixel = bit 0)
  BLE.resetQueue();
  await BLE.send(new Uint8Array([0x1b, 0x40]));
  await sleep(100);
  await BLE.send(numBmpInv(4));
  await sleep(500);
  await BLE.send(FEED);
  await sleep(GAP);

  // 5: LuckPrinter — 10 FF F1 03 + 12x00 wake + raster + 10 FF F1 45
  BLE.resetQueue();
  await BLE.send(new Uint8Array([0x10, 0xff, 0xf1, 0x03]));
  await sleep(300);
  await BLE.send(new Uint8Array(12));
  await sleep(300);
  await BLE.send(numBmp(5));
  await sleep(800);
  await BLE.send(FEED);
  await sleep(200);
  await BLE.send(new Uint8Array([0x10, 0xff, 0xf1, 0x45]));
  await sleep(GAP);

  // 6: AiYin — 10 FF FE 01 + raster + 1D 0C + 10 FF FE 45
  BLE.resetQueue();
  await BLE.send(new Uint8Array([0x10, 0xff, 0xfe, 0x01]));
  await sleep(200);
  await BLE.send(numBmp(6));
  await sleep(800);
  await BLE.send(new Uint8Array([0x1d, 0x0c]));
  await sleep(200);
  await BLE.send(new Uint8Array([0x10, 0xff, 0xfe, 0x45]));
  await sleep(GAP);

  // ── Tests 7-8 on ffe1 (HM-10 BLE UART) if the device has it ─────────────
  const ffe1 = await BLE.getAltChar('0000ffe0-0000-1000-8000-00805f9b34fb');
  if (ffe1) {
    // 7: ESC/POS text on ffe1
    await directSend(ffe1, new Uint8Array([0x1b, 0x40]));
    await sleep(100);
    await directSend(ffe1, new Uint8Array([0x37, 0x0a])); // "7\n"
    await directSend(ffe1, FEED);
    await sleep(GAP);

    // 8: ESC/POS raster on ffe1
    await directSend(ffe1, new Uint8Array([0x1b, 0x40]));
    await sleep(100);
    await directSend(ffe1, numBmp(8));
    await sleep(500);
    await directSend(ffe1, FEED);
    await sleep(GAP);
  }
}

// ── Product label ─────────────────────────────────────────────────────────────
export async function printProductLabel(product) {
  const code  = productCode(product.id);
  const price = `Rs ${Number(product.selling_price ?? 0).toFixed(0)}`;

  if (BLE.isConnected()) {
    const W = PRINT_WIDTH;
    const bc = await makeBarcodeCanvas(code);

    const tmpC = document.createElement('canvas');
    tmpC.width = W; tmpC.height = 200;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.font = 'bold 26px Arial';
    const nameLines = wrapText(tmpCtx, String(product.name), W - 24);

    const h = 92 + nameLines.length * 34 + bc.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    let y = 12;
    ctx.font = 'bold 26px Arial';
    for (const line of nameLines) {
      ctx.fillText(line, W / 2, y);
      y += 34;
    }
    y += 8;

    ctx.font = 'bold 44px Arial';
    ctx.fillText(price, W / 2, y);
    y += 52;

    ctx.drawImage(bc, Math.floor((W - bc.width) / 2), y);

    await rasterPrint(c);
    return;
  }

  const bcImg = await makeBarcodeImg(code);
  printInPage(`
    <div style="padding:3mm;text-align:center;">
      <div style="font-size:11pt;font-weight:bold;line-height:1.3;margin-bottom:2mm;">${esc(product.name)}</div>
      <div style="font-size:17pt;font-weight:bold;margin-bottom:3mm;">${esc(price)}</div>
      ${bcImg}
    </div>
  `);
}

// ── Phone label ───────────────────────────────────────────────────────────────
export async function printPhoneLabel(phone) {
  const code  = phoneCode(phone.id);
  const price = `Rs ${Number(phone.selling_price ?? 0).toFixed(0)}`;
  const sub   = [phone.storage, phone.condition].filter(Boolean).join(' / ');

  if (BLE.isConnected()) {
    const W = PRINT_WIDTH;
    const bc = await makeBarcodeCanvas(code);

    const tmpC = document.createElement('canvas');
    tmpC.width = W; tmpC.height = 200;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.font = 'bold 26px Arial';
    const modelLines = wrapText(tmpCtx, String(phone.model), W - 24);

    const subH = sub ? 30 : 0;
    const h = 92 + modelLines.length * 34 + subH + bc.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    let y = 12;
    ctx.font = 'bold 26px Arial';
    for (const line of modelLines) {
      ctx.fillText(line, W / 2, y);
      y += 34;
    }

    if (sub) {
      y += 4;
      ctx.font = '22px Arial';
      ctx.fillText(sub, W / 2, y);
      y += 30;
    }
    y += 8;

    ctx.font = 'bold 44px Arial';
    ctx.fillText(price, W / 2, y);
    y += 52;

    ctx.drawImage(bc, Math.floor((W - bc.width) / 2), y);

    await rasterPrint(c);
    return;
  }

  const bcImg = await makeBarcodeImg(code);
  printInPage(`
    <div style="padding:3mm;text-align:center;">
      <div style="font-size:11pt;font-weight:bold;line-height:1.3;margin-bottom:1mm;">${esc(phone.model)}</div>
      ${sub ? `<div style="font-size:9pt;color:#333;margin-bottom:2mm;">${esc(sub)}</div>` : ''}
      <div style="font-size:17pt;font-weight:bold;margin-bottom:3mm;">${esc(price)}</div>
      ${bcImg}
    </div>
  `);
}

// ── Sale receipt ──────────────────────────────────────────────────────────────
const SHOP = 'UniverCell';

export async function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit-${creditCustomer}`
    : payment;

  if (BLE.isConnected()) {
    const W = PRINT_WIDTH;
    // height: 12 top + 38 shop + 30 date + 8 div + n*28 items + 8 div + 38 total + 28 pay + 28 id + 22 thanks + 12 bottom
    const h = 224 + items.length * 28;
    const c = document.createElement('canvas');
    c.width = W; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';

    let y = 12;

    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(SHOP, W / 2, y);
    y += 38;

    ctx.font = '22px Arial';
    ctx.fillText(now, W / 2, y);
    y += 30;

    // dashed divider
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(8, y + 3); ctx.lineTo(W - 8, y + 3);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
    y += 8;

    ctx.font = '20px Arial';
    for (const item of items) {
      const qty = Number(item.qty ?? 1);
      const net = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
      ctx.textAlign = 'left';
      ctx.fillText(`x${qty} ${item.name}`.slice(0, 24), 8, y);
      ctx.textAlign = 'right';
      ctx.fillText(`Rs${net.toFixed(0)}`, W - 8, y);
      y += 28;
    }

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(8, y + 3); ctx.lineTo(W - 8, y + 3);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 8;

    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', 8, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Rs${Number(total).toFixed(0)}`, W - 8, y);
    y += 38;

    ctx.font = '22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Pay: ${payLabel}`, 8, y);
    y += 28;

    ctx.fillText(`#${id}`, 8, y);
    y += 28;

    ctx.textAlign = 'center';
    ctx.fillText('Thank you!', W / 2, y);

    await rasterPrint(c);
    return;
  }

  // Fallback — window.print()
  const rows = items.map(item => {
    const qty = Number(item.qty ?? 1);
    const net = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    return `<tr>
      <td style="padding:1.5mm 0;font-size:9pt;vertical-align:top;">\xD7${qty} ${esc(item.name)}</td>
      <td style="padding:1.5mm 0 1.5mm 2mm;font-size:9pt;text-align:right;vertical-align:top;white-space:nowrap;">Rs ${net.toFixed(0)}</td>
    </tr>`;
  }).join('');
  const payLabelH = payment === 'Credit' && creditCustomer
    ? `Credit — ${esc(creditCustomer)}`
    : esc(payment);

  printInPage(`
    <div style="padding:3mm;">
      <div style="text-align:center;font-size:14pt;font-weight:bold;margin-bottom:1mm;">${esc(SHOP)}</div>
      <div style="text-align:center;font-size:8pt;color:#555;margin-bottom:2mm;">${esc(now)}</div>
      <hr/>
      <table>${rows}</table>
      <hr/>
      <table><tr>
        <td style="font-size:12pt;font-weight:bold;">TOTAL</td>
        <td style="font-size:12pt;font-weight:bold;text-align:right;">Rs ${Number(total).toFixed(0)}</td>
      </tr></table>
      <div style="font-size:9pt;margin-top:2mm;">Pay: ${payLabelH}</div>
      <div style="font-size:8pt;color:#555;margin-top:1mm;">#${esc(String(id))}</div>
      <div style="text-align:center;font-size:9pt;margin-top:3mm;">Thank you!</div>
    </div>
  `);
}
