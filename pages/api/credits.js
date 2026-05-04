import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const all = req.query.all === '1';
    const salesFilter  = all ? "s.payment_method='Credit'"  : "s.payment_method='Credit' AND s.credit_cleared=0";
    const repairFilter = all ? "payment_method='Credit'"    : "payment_method='Credit' AND credit_cleared=0";

    const sales = await db.query(
      `SELECT s.*, GROUP_CONCAT(si.product_name || ' x' || si.quantity) as items_summary
       FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE ${salesFilter}
       GROUP BY s.id ORDER BY s.created_at DESC`
    );

    const repairs = await db.query(
      `SELECT * FROM repairs WHERE ${repairFilter} ORDER BY created_at DESC`
    );

    return res.json({ sales, repairs });
  }

  if (req.method === 'PUT') {
    const { type, id } = req.body;
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });

    if (type === 'sale') {
      await db.run(
        "UPDATE sales SET credit_cleared=1, credit_cleared_at=datetime('now') WHERE id=? AND payment_method='Credit'",
        [Number(id)]
      );
    } else if (type === 'repair') {
      await db.run(
        "UPDATE repairs SET credit_cleared=1, credit_cleared_at=datetime('now') WHERE id=? AND payment_method='Credit'",
        [Number(id)]
      );
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
