// 58mm thermal printer → Deli S441
// Uses in-page hidden div + window.print() — no popup windows (popups cause
// "preparing preview" to hang on Android Chrome's print service).
// Barcode is rendered to canvas PNG — avoids SVG rendering bugs in Android PDF renderer.

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

// Renders barcode to canvas → returns <img src="data:..."> string.
// Canvas PNG avoids Android PDF renderer SVG bugs entirely.
async function makeBarcodeImg(code) {
  try {
    const JsBarcode = (await import('jsbarcode')).default;
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, code, {
      format: 'CODE128',
      width: 2,
      height: 52,
      displayValue: true,
      fontSize: 13,
      margin: 6,
      background: '#ffffff',
      lineColor: '#000000',
    });
    const src = canvas.toDataURL('image/png');
    return `<img src="${src}" style="width:100%;height:auto;display:block;" />`;
  } catch {
    return `<div style="font-size:11pt;font-weight:bold;letter-spacing:3px;text-align:center;padding:3mm 0;">${esc(code)}</div>`;
  }
}

// Injects a hidden div into the current page, adds @media print CSS that hides
// everything else, calls window.print(), then cleans up via afterprint event.
// This is the most reliable approach on Android Chrome.
function printInPage(bodyHtml) {
  const PRINT_ID = '__tp__';

  // Remove any leftover print div from a previous job
  document.getElementById(PRINT_ID)?.remove();
  document.getElementById(PRINT_ID + '_s')?.remove();

  const div = document.createElement('div');
  div.id = PRINT_ID;
  div.style.display = 'none'; // hidden on screen
  div.innerHTML = bodyHtml;
  document.body.appendChild(div);

  const style = document.createElement('style');
  style.id = PRINT_ID + '_s';
  style.textContent = `
    @media print {
      @page { size: 58mm auto; margin: 0; }
      body > *:not(#${PRINT_ID}) { display: none !important; }
      #${PRINT_ID} {
        display: block !important;
        width: 58mm;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10pt;
        color: #000;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      #${PRINT_ID} * { box-sizing: border-box; }
      #${PRINT_ID} table { width: 100%; border-collapse: collapse; }
      #${PRINT_ID} hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
    }
  `;
  document.head.appendChild(style);

  function cleanup() {
    div.remove();
    style.remove();
  }

  setTimeout(() => {
    window.print();
    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback cleanup if afterprint doesn't fire (some Android browsers skip it)
    setTimeout(cleanup, 4000);
  }, 250);
}

// ── Product label ─────────────────────────────────────────────────────────────
// Call: printProductLabel({ id, name, selling_price })
export async function printProductLabel(product) {
  const code  = productCode(product.id);
  const price = Number(product.selling_price ?? 0).toFixed(0);
  const bc    = await makeBarcodeImg(code);

  printInPage(`
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
  const code  = phoneCode(phone.id);
  const price = Number(phone.selling_price ?? 0).toFixed(0);
  const sub   = [phone.storage, phone.condition].filter(Boolean).join(' \xB7 ');
  const bc    = await makeBarcodeImg(code);

  printInPage(`
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

  printInPage(`
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
