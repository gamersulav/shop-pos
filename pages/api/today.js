import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const NPT_TODAY = "date('now', '+5 hours', '+45 minutes')";
function nptDate(col) { return `date(${col}, '+5 hours', '+45 minutes')`; }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const [accessories, phones, repairs, settingRows] = await Promise.all([
    db.queryOne(`SELECT COALESCE(SUM(si.quantity*si.unit_price - COALESCE(si.item_discount,0)),0) as amt
                 FROM sale_items si JOIN sales s ON s.id=si.sale_id
                 WHERE si.product_id IS NOT NULL AND ${nptDate('s.created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(si.quantity),0) as qty
                 FROM sale_items si JOIN sales s ON s.id=si.sale_id
                 WHERE si.product_id IS NULL AND ${nptDate('s.created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as amt
                 FROM repairs WHERE status IN ('Done','Delivered') AND ${nptDate('created_at')} = ${NPT_TODAY}`),
    db.query(`SELECT key, value FROM shop_settings WHERE key IN ('target_phones_qty','target_accessories_amt','target_repairs_amt')`),
  ]);

  const sm = {};
  for (const row of settingRows) sm[row.key] = Number(row.value) || 0;

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    phonesQty:      Number(phones?.qty      || 0),
    accessoriesAmt: Number(accessories?.amt || 0),
    repairsAmt:     Number(repairs?.amt     || 0),
    targets: {
      phonesQty:      sm['target_phones_qty']      || 0,
      accessoriesAmt: sm['target_accessories_amt'] || 0,
      repairsAmt:     sm['target_repairs_amt']     || 0,
    },
  });
}
