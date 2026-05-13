// 58mm thermal printer — direct HTML printing, no html2canvas → Deli S441
// window.open() called before any await so browsers don't block the popup

export const productCode = id => 'P'  + String(id).padStart(5, '0');
export const phoneCode   = id => 'PH' + String(id).padStart(4, '0');

export function parseCode(raw) {
  const code = String(raw).trim().toUpperCase();
  if (/^PH\d+$/.test(code)) return { type: 'phone',   id: parseInt(code.slice(2)) };
  if (/^P\d+$/.test(code))  return { type: 'product', id: parseInt(code.slice(1)) };
  return null;
}

function esc(s) {
  return String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
}

async function makeBarcodeHtml(code) {
  try {
    const JsBarcode = (await import('jsbarcode')).default;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    JsBarcode(svg, code, {
      format: 'CODE128',
      width: 1.6,
      height: 42,
      displayValue: true,
      fontSize: 11,
      margin: 3,
      background: '#ffffff',
      lineColor: '#000000',
    });
    const html = svg.outerHTML;
    document.body.removeChild(svg);
    return html;
  } catch {
    // fallback: plain text code if jsbarcode fails
    return `<div style="font-size:11pt;font-weight:bold;letter-spacing:3px;text-align:center;">${esc(code)}</div>`;
  }
}

const BASE_STYLE = `
  @page { size: 58mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 58mm; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  svg { display: block; width: 100% !important; height: auto !important; }
`;

function writeAndPrint(win, bodyHtml) {
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    win.addEventListener('afterprint', () => win.close());
  }, 150);
}

// ── Product label ─────────────────────────────────────────────────────────────
// Call: printProductLabel({ id, name, selling_price })
export async function printProductLabel(product) {
  const win = window.open('', '_blank', 'width=420,height=420');
  if (!win) { alert('Allow pop-ups to print labels.'); return; }

  const code  = productCode(product.id);
  const price = Number(product.selling_price ?? 0).toFixed(0);
  const bc    = await makeBarcodeHtml(code);

  writeAndPrint(win, `
    <div style="padding:3mm;text-align:center;">
      <div style="font-size:11pt;font-weight:bold;line-height:1.3;margin-bottom:2mm;">${esc(product.name)}</div>
      <div style="font-size:17pt;font-weight:bold;margin-bottom:3mm;">Rs ${esc(price)}</div>
      ${bc}
    </div>
  `);
}

// ── Phone label ───────────────────────────────────────────────────────────────
// Call: printPhoneLabel({ id, model, storage, condition, selling_price })
export async function printPhoneLabel(phone) {
  const win = window.open('', '_blank', 'width=420,height=420');
  if (!win) { alert('Allow pop-ups to print labels.'); return; }

  const code  = phoneCode(phone.id);
  const price = Number(phone.selling_price ?? 0).toFixed(0);
  const sub   = [phone.storage, phone.condition].filter(Boolean).join(' · ');
  const bc    = await makeBarcodeHtml(code);

  writeAndPrint(win, `
    <div style="padding:3mm;text-align:center;">
      <div style="font-size:11pt;font-weight:bold;line-height:1.3;margin-bottom:1mm;">${esc(phone.model)}</div>
      ${sub ? `<div style="font-size:9pt;color:#333;margin-bottom:2mm;">${esc(sub)}</div>` : ''}
      <div style="font-size:17pt;font-weight:bold;margin-bottom:3mm;">Rs ${esc(price)}</div>
      ${bc}
    </div>
  `);
}

// ── Sale receipt ──────────────────────────────────────────────────────────────
// Call: printReceipt({ id, items:[{name,qty,price,discount}], total, payment, creditCustomer })
const SHOP = 'UniverCell';

export function printReceipt({ id, items, total, payment, creditCustomer = '' }) {
  const win = window.open('', '_blank', 'width=420,height=600');
  if (!win) { alert('Allow pop-ups to print receipts.'); return; }

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const payLabel = payment === 'Credit' && creditCustomer
    ? `Credit — ${esc(creditCustomer)}`
    : esc(payment);

  const rows = items.map(item => {
    const qty = Number(item.qty ?? 1);
    const net = Math.max(0, Number(item.price) * qty - (Number(item.discount) || 0));
    return `<tr>
      <td style="padding:1.5mm 0;font-size:9pt;vertical-align:top;">\xD7${qty} ${esc(item.name)}</td>
      <td style="padding:1.5mm 0 1.5mm 2mm;font-size:9pt;text-align:right;vertical-align:top;white-space:nowrap;">Rs ${net.toFixed(0)}</td>
    </tr>`;
  }).join('');

  writeAndPrint(win, `
    <div style="padding:3mm;">
      <div style="text-align:center;font-size:14pt;font-weight:bold;margin-bottom:1mm;">${esc(SHOP)}</div>
      <div style="text-align:center;font-size:8pt;color:#555;margin-bottom:2mm;">${esc(now)}</div>
      <hr/>
      <table>${rows}</table>
      <hr/>
      <table>
        <tr>
          <td style="font-size:12pt;font-weight:bold;">TOTAL</td>
          <td style="font-size:12pt;font-weight:bold;text-align:right;">Rs ${Number(total).toFixed(0)}</td>
        </tr>
      </table>
      <div style="font-size:9pt;margin-top:2mm;">Pay: ${payLabel}</div>
      <div style="font-size:8pt;color:#555;margin-top:1mm;">#${esc(String(id))}</div>
      <div style="text-align:center;font-size:9pt;margin-top:3mm;">Thank you!</div>
    </div>
  `);
}
