import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const cats = await db.query(`
      SELECT c.id, c.name, COUNT(p.id) as product_count
      FROM product_categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
      GROUP BY c.id ORDER BY c.name
    `);
    return res.json(cats);
  }

  if (req.method === 'POST') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    try {
      const { lastId } = await db.run('INSERT INTO product_categories (name) VALUES (?)', [name.trim()]);
      return res.json({ id: lastId, name: name.trim(), product_count: 0 });
    } catch {
      return res.status(409).json({ error: 'Category already exists' });
    }
  }

  res.status(405).end();
}
