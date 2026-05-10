import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const all = req.query.all === '1';
    const salesFilter  = all ? "payment_method='Credit'"  : "payment_method='Credit' AND credit_cleared=0";
    const repairFilter = all ? "payment_method='Credit'"  : "payment_method='Credit' AND credit_cleared=0";

    const salesRows = await db.query(
      `SELECT * FROM sales WHERE ${salesFilter} ORDER BY created_at DESC`
    );

    let itemsMap = {};
    if (salesRows.length > 0) {
      const ids = salesRows.map(s => Number(s.id));
      const placeholders = ids.map(() => '?').join(',');
      const saleItems = await db.query(
        `SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY id`,
        ids
      );
      for (const si of saleItems) {
        const sid = Number(si.sale_id);
        if (!itemsMap[sid]) itemsMap[sid] = [];
        itemsMap[sid].push(si);
      }
    }

    const sales = salesRows.map(s => {
      const items = itemsMap[Number(s.id)] || [];
      return { ...s, items, items_summary: items.map(si => `${si.product_name} x${si.quantity}`).join(', ') };
    });

    const repairs = await db.query(
      `SELECT * FROM repairs WHERE ${repairFilter} ORDER BY created_at DESC`
    );

    return res.json({ sales, repairs });
  }

  if (req.method === 'PUT') {
    const { type, id, discount = 0 } = req.body;
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });
    const disc = Math.max(0, Number(discount) || 0);

    if (type === 'sale') {
      await db.run(
        "UPDATE sales SET credit_cleared=1, credit_cleared_at=datetime('now'), credit_discount=? WHERE id=? AND payment_method='Credit'",
        [disc, Number(id)]
      );
    } else if (type === 'repair') {
      await db.run(
        "UPDATE repairs SET credit_cleared=1, credit_cleared_at=datetime('now'), credit_discount=? WHERE id=? AND payment_method='Credit'",
        [disc, Number(id)]
      );
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
