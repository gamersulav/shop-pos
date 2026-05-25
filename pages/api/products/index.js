import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export const config = { api: { bodyParser: { sizeLimit: '3mb' } } };

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const rows = await db.query(`
      SELECT p.*, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.active = 1 ORDER BY p.name
    `);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    if (session.role !== 'owner') {
      return res.json(rows.map(({ cost_price, ...p }) => p));
    }
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { name, selling_price, cost_price, stock = 0, photo = null, category_id = null } = req.body;
    if (!name || !selling_price) return res.status(400).json({ error: 'Name and selling price required' });
    if (session.role !== 'owner' && !category_id) return res.status(400).json({ error: 'Category required' });
    const cost = session.role === 'owner' ? (parseFloat(cost_price) || 0) : 0;
    const { lastId } = await db.run(
      'INSERT INTO products (name,selling_price,cost_price,stock,photo,category_id) VALUES (?,?,?,?,?,?)',
      [name, parseFloat(selling_price), cost, parseInt(stock) || 0, photo || null, category_id ? parseInt(category_id) : null]
    );
    return res.json({ id: lastId });
  }

  res.status(405).end();
}
