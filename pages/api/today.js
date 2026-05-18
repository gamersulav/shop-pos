import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const NPT_TODAY = "date('now', '+5 hours', '+45 minutes')";
function nptDate(col) { return `date(${col}, '+5 hours', '+45 minutes')`; }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const [sales, repairs, setting] = await Promise.all([
    db.queryOne(`SELECT COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as revenue FROM repairs WHERE status IN ('Done','Delivered') AND ${nptDate('created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT value FROM shop_settings WHERE key='daily_target'`),
  ]);

  const revenue = Number(sales?.revenue || 0) + Number(repairs?.revenue || 0);
  const target  = Number(setting?.value || 0);

  res.setHeader('Cache-Control', 'no-store');
  res.json({ revenue, target });
}
