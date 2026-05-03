import { getDb, runTransaction } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();

  if (req.method === 'GET') {
    const rows = db.prepare('SELECT * FROM stock_entries ORDER BY created_at DESC LIMIT 200').all();
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { productId, qty } = req.body;
    if (!productId || !qty) return res.status(400).json({ error: 'Missing fields' });

    const prod = db.prepare('SELECT * FROM products WHERE id=?').get(Number(productId));
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    runTransaction(db, () => {
      db.prepare('INSERT INTO stock_entries (product_id, product_name, quantity, user_id) VALUES (?,?,?,?)')
        .run(prod.id, prod.name, Number(qty), session.id);
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(Number(qty), prod.id);
    });

    return res.json({ ok: true });
  }

  res.status(405).end();
}
