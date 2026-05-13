// Label printing via Web Share API — shares PNG image to PrintyBunny on Android

// ── Code128 B barcode renderer ────────────────────────────────────────────────
const C128 = [
  '212222','222122','222221','121223','121322','131222','122213','122312',
  '132212','221213','221312','231212','112232','122132','122231','113222',
  '123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321',
  '232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321',
  '331121','312113','312311','332111','314111','221411','431111','111224',
  '111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112',
  '421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412',
  '211214','211232','233111',
];
const STOP_PAT = '2331112';

function drawCode128(ctx, text, x, y, barH, narrow = 2) {
  const vals = [...text].map(c => c.charCodeAt(0) - 32);
  let check = 104;
  vals.forEach((v, i) => { check += (i + 1) * v; });
  check %= 103;
  ctx.fillStyle = '#000';
  let cx = x + 10 * narrow;
  for (const pat of [C128[104], ...vals.map(v => C128[v]), C128[check], STOP_PAT]) {
    let bar = true;
    for (const ch of pat) {
      const w = parseInt(ch) * narrow;
      if (bar) ctx.fillRect(cx, y, w, barH);
      cx += w; bar = !bar;
    }
  }
}

function barcodeW(text, narrow = 2) {
  return (10 + 11 + text.length * 11 + 11 + 13 + 10) * narrow;
}

// ── Canvas setup (48×30mm at 203 DPI = 384×240 dots) ─────────────────────────
const PW = 384;
const PH = 240;

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = PW; canvas.height = PH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
  return { canvas, ctx };
}

// ── Share canvas as PNG via Web Share API ─────────────────────────────────────
async function printCanvas(canvas, filename = 'label.png') {
  const blob = await new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), 'image/png')
  );
  const file = new File([blob], filename, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] }))
    throw new Error('File sharing not supported. Use Chrome on Android.');
  await navigator.share({ files: [file] });
}

// ── Connection stubs (no BLE needed — PrintyBunny handles the printer) ────────
export const isConnected = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export const deviceName = () => isConnected() ? 'PrintyBunny' : null;

export async function connect() {
  if (!isConnected())
    throw new Error('Web Share not supported. Use Chrome on Android.');
  return 'PrintyBunny';
}

export function disconnect() {}

// ── Barcode helpers ───────────────────────────────────────────────────────────
export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

function safe(s) { return String(s ?? '').replace(/[\r\n]/g, ' '); }

// ── Product label 48×30mm ─────────────────────────────────────────────────────
export async function printProductLabel(product) {
  const { canvas, ctx } = newCanvas();
  const code = productCode(product.id);
  const bw   = barcodeW(code, 2);
  drawCode128(ctx, code, Math.floor((PW - bw) / 2), 8, 70, 2);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(safe(product.name).substring(0, 24), 8, 90);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`Rs ${Number(product.selling_price).toFixed(0)}`, 8, 118);
  await printCanvas(canvas, `label-${code}.png`);
}

// ── Phone label 48×30mm ───────────────────────────────────────────────────────
export async function printPhoneLabel(phone) {
  const { canvas, ctx } = newCanvas();
  const code = phoneCode(phone.id);
  const bw   = barcodeW(code, 2);
  drawCode128(ctx, code, Math.floor((PW - bw) / 2), 8, 70, 2);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(safe(phone.model).substring(0, 26), 8, 90);
  ctx.font = '18px sans-serif';
  ctx.fillText(`${safe(phone.condition)} · Rs ${Number(phone.selling_price).toFixed(0)}`, 8, 116);
  await printCanvas(canvas, `label-${code}.png`);
}

// ── Sale receipt (48×30mm label) ──────────────────────────────────────────────
const SHOP = 'UniverCell';

export async function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  const { canvas, ctx } = newCanvas();

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  let y = 4;

  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(SHOP, Math.floor((PW - ctx.measureText(SHOP).width) / 2), y);
  y += 26;

  ctx.font = '14px sans-serif';
  ctx.fillText(safe(now), 4, y);
  y += 18;

  ctx.fillRect(4, y, PW - 8, 1); y += 5;

  const visible  = items.slice(0, 6);
  const overflow = items.length - 6;

  ctx.font = '13px sans-serif';
  for (const item of visible) {
    const qty   = Number(item.qty ?? 1);
    const net   = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    const right = `Rs${net.toFixed(0)}`;
    ctx.fillText(`x${qty} ${safe(item.name)}`, 4, y);
    ctx.fillText(right, PW - 4 - ctx.measureText(right).width, y);
    y += 17;
  }
  if (overflow > 0) { ctx.fillText(`+${overflow} more`, 4, y); y += 17; }

  ctx.fillRect(4, y, PW - 8, 1); y += 5;

  ctx.font = 'bold 20px sans-serif';
  const ts = `Rs ${Number(total).toFixed(0)}`;
  ctx.fillText('TOTAL', 4, y);
  ctx.fillText(ts, PW - 4 - ctx.measureText(ts).width, y);
  y += 24;

  ctx.font = '13px sans-serif';
  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit-${safe(creditCustomer).substring(0, 16)}`
    : safe(payment);
  ctx.fillText(`Pay: ${payLabel}`, 4, y); y += 17;
  ctx.fillText(`#${id}  Thank you!`, 4, y);

  await printCanvas(canvas, `receipt-${id}.png`);
}
