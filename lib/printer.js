// Browser-based thermal print — html2canvas + JsBarcode → window.print()
// @page size: 58mm — works with Android native print dialog → Deli S441

// ── Barcode helpers (used by scanner in staff.js) ────────────────────────────
export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

// ── Shared print helpers ─────────────────────────────────────────────────────
function safe(s) { return String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

const PAGE_CSS = `
  @page { size: 58mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 58mm; font-family: Arial, sans-serif; background: #fff; color: #000; }
`;

async function captureAndPrint(win, el) {
  console.log('[print] loading html2canvas…');
  const h2c = (await import('html2canvas')).default;
  console.log('[print] capturing DOM…');
  const canvas = await h2c(el, { scale: 3, useCORS: true, backgroundColor: '#fff' });
  console.log('[print] canvas size:', canvas.width, 'x', canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  console.log('[print] writing image to print window…');
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head>
    <style>
      @page { size: 58mm auto; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
      img { display: block; width: 58mm; height: auto; }
    </style>
  </head><body><img src="${dataUrl}"/></body></html>`);
  win.document.close();
  console.log('[print] calling print dialog…');
  win.focus();
  win.print();
  win.addEventListener('afterprint', () => win.close());
}

// ── Product label ─────────────────────────────────────────────────────────────
// Fields: name, selling_price, id
export async function printProductLabel(product) {
  console.log('[printProductLabel] start', product);
  const win = window.open('', '_blank', 'width=400,height=300');
  if (!win) { alert('Allow pop-ups to print labels.'); return; }

  const code = productCode(product.id);
  const price = Number(product.selling_price ?? 0).toFixed(0);

  const div = document.createElement('div');
  div.style.cssText = 'width:58mm;padding:3mm;background:#fff;';
  div.innerHTML = `
    <style>${PAGE_CSS}</style>
    <div style="font-size:11pt;font-weight:bold;line-height:1.2;margin-bottom:2mm;">
      ${safe(product.name)}
    </div>
    <div style="font-size:13pt;font-weight:bold;margin-bottom:2mm;">Rs ${safe(price)}</div>
    <div style="font-size:8pt;color:#444;margin-bottom:2mm;">${safe(code)}</div>
    <svg id="bc-prod"></svg>
  `;
  document.body.appendChild(div);

  console.log('[printProductLabel] rendering barcode…');
  const JsBarcode = (await import('jsbarcode')).default;
  JsBarcode('#bc-prod', code, {
    format: 'CODE128', width: 1.5, height: 38,
    displayValue: false, margin: 0,
  });

  await captureAndPrint(win, div);
  document.body.removeChild(div);
  console.log('[printProductLabel] done');
}

// ── Phone label ───────────────────────────────────────────────────────────────
// Fields: id, model, storage, condition, selling_price
export async function printPhoneLabel(phone) {
  console.log('[printPhoneLabel] start', phone);
  const win = window.open('', '_blank', 'width:400,height:300');
  if (!win) { alert('Allow pop-ups to print labels.'); return; }

  const code  = phoneCode(phone.id);
  const price = Number(phone.selling_price ?? 0).toFixed(0);
  const sub   = [phone.storage, phone.condition].filter(Boolean).join(' · ');

  const div = document.createElement('div');
  div.style.cssText = 'width:58mm;padding:3mm;background:#fff;';
  div.innerHTML = `
    <style>${PAGE_CSS}</style>
    <div style="font-size:11pt;font-weight:bold;line-height:1.2;margin-bottom:1mm;">
      ${safe(phone.model)}
    </div>
    ${sub ? `<div style="font-size:9pt;color:#333;margin-bottom:2mm;">${safe(sub)}</div>` : ''}
    <div style="font-size:13pt;font-weight:bold;margin-bottom:2mm;">Rs ${safe(price)}</div>
    <div style="font-size:8pt;color:#444;margin-bottom:2mm;">${safe(code)}</div>
    <svg id="bc-phone"></svg>
  `;
  document.body.appendChild(div);

  console.log('[printPhoneLabel] rendering barcode…');
  const JsBarcode = (await import('jsbarcode')).default;
  JsBarcode('#bc-phone', code, {
    format: 'CODE128', width: 1.5, height: 38,
    displayValue: false, margin: 0,
  });

  await captureAndPrint(win, div);
  document.body.removeChild(div);
  console.log('[printPhoneLabel] done');
}

// ── Sale receipt ──────────────────────────────────────────────────────────────
const SHOP = 'UniverCell';

export async function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  console.log('[printReceipt] start, id:', id, 'items:', items.length);
  const win = window.open('', '_blank', 'width=400,height=500');
  if (!win) { alert('Allow pop-ups to print receipts.'); return; }

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit — ${creditCustomer}`
    : payment;

  const rows = items.slice(0, 8).map(item => {
    const qty = Number(item.qty ?? 1);
    const net = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    return `<tr>
      <td style="padding:1mm 0;font-size:9pt;">x${qty} ${safe(item.name)}</td>
      <td style="padding:1mm 0;font-size:9pt;text-align:right;">Rs${net.toFixed(0)}</td>
    </tr>`;
  }).join('');
  const overflow = items.length - 8;

  const div = document.createElement('div');
  div.style.cssText = 'width:58mm;padding:3mm;background:#fff;';
  div.innerHTML = `
    <style>${PAGE_CSS}
      table { width: 100%; border-collapse: collapse; }
      hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
    </style>
    <div style="text-align:center;font-size:14pt;font-weight:bold;margin-bottom:1mm;">${safe(SHOP)}</div>
    <div style="text-align:center;font-size:8pt;color:#555;margin-bottom:2mm;">${safe(now)}</div>
    <hr/>
    <table>${rows}</table>
    ${overflow > 0 ? `<div style="font-size:8pt;color:#555;">+${overflow} more items</div>` : ''}
    <hr/>
    <table>
      <tr>
        <td style="font-size:12pt;font-weight:bold;">TOTAL</td>
        <td style="font-size:12pt;font-weight:bold;text-align:right;">Rs ${Number(total).toFixed(0)}</td>
      </tr>
    </table>
    <div style="font-size:9pt;margin-top:2mm;">Pay: ${safe(payLabel)}</div>
    <div style="font-size:8pt;color:#555;margin-top:1mm;">#${safe(String(id))}</div>
    <div style="text-align:center;font-size:9pt;margin-top:3mm;">Thank you!</div>
  `;
  document.body.appendChild(div);

  await captureAndPrint(win, div);
  document.body.removeChild(div);
  console.log('[printReceipt] done');
}
