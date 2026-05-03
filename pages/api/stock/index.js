import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const rows = await db.query('SELECT * FROM stock_entries ORDER BY created_at DESC LIMIT 200');
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { productId, qty } = req.body;
    if (!productId || !qty) return res.status(400).json({ error: 'Missing fields' });
    const prod = await db.queryOne('SELECT * FROM products WHERE id=?', [Number(productId)]);
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    await db.tx(async (tx) => {
      await tx.run(
        'INSERT INTO stock_entries (product_id,product_name,quantity,user_id) VALUES (?,?,?,?)',
        [prod.id, prod.name, Number(qty), session.id]
      );
      await tx.run('UPDATE products SET stock=stock+? WHERE id=?', [Number(qty), prod.id]);
    });

    return res.json({ ok: true });
  }

  res.status(405).end();
}
