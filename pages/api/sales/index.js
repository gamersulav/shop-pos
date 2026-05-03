import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const sales = await db.query(
      `SELECT s.*, GROUP_CONCAT(si.product_name || ' x' || si.quantity) as items_summary
       FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 100`
    );
    return res.json(sales);
  }

  if (req.method === 'POST') {
    const { items, payment } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No items' });

    const total = items.reduce((s, i) => s + i.price * i.qty, 0);

    const saleId = await db.tx(async (tx) => {
      const { lastId } = await tx.run(
        'INSERT INTO sales (payment_method,total_amount,user_id) VALUES (?,?,?)',
        [payment, total, session.id]
      );
      for (const item of items) {
        const pid  = Number(item.productId);
        const prod = await tx.queryOne('SELECT * FROM products WHERE id=?', [pid]);
        // Snapshot cost_price at time of sale for accurate profit tracking
        await tx.run(
          'INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price) VALUES (?,?,?,?,?,?)',
          [lastId, pid, prod ? prod.name : 'Unknown', item.qty, item.price, prod ? Number(prod.cost_price) : 0]
        );
        if (prod) await tx.run('UPDATE products SET stock=stock-? WHERE id=?', [item.qty, pid]);
      }
      return lastId;
    });

    return res.json({ ok: true, id: saleId });
  }

  res.status(405).end();
}
