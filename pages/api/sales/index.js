import { getDb, runTransaction } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();

  if (req.method === 'GET') {
    const sales = db.prepare(`
      SELECT s.*, GROUP_CONCAT(si.product_name || ' x' || si.quantity) as items_summary
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `).all();
    return res.json(sales);
  }

  if (req.method === 'POST') {
    const { items, payment } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No items' });

    const total = items.reduce((s, i) => s + (i.price * i.qty), 0);

    const insertSale = db.prepare('INSERT INTO sales (payment_method, total_amount, user_id) VALUES (?,?,?)');
    const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price) VALUES (?,?,?,?,?)');
    const getProduct = db.prepare('SELECT * FROM products WHERE id=?');
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    const saleId = runTransaction(db, () => {
      const { lastInsertRowid } = insertSale.run(payment, total, session.id);
      for (const item of items) {
        const pid = Number(item.productId);
        const prod = getProduct.get(pid);
        insertItem.run(lastInsertRowid, pid, prod ? prod.name : 'Unknown', item.qty, item.price);
        if (prod) updateStock.run(item.qty, pid);
      }
      return lastInsertRowid;
    });

    return res.json({ ok: true, id: saleId });
  }

  res.status(405).end();
}
