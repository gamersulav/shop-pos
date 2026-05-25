import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'DELETE') {
    await db.run('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
    await db.run('DELETE FROM product_categories WHERE id = ?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
