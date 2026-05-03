import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();

  if (req.method === 'GET') {
    const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
    // Strip cost_price from staff responses
    if (session.role !== 'owner') {
      return res.json(rows.map(({ cost_price, ...p }) => p));
    }
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { name, selling_price, cost_price, stock = 0 } = req.body;
    if (!name || !selling_price) return res.status(400).json({ error: 'Name and selling price required' });

    // Staff can add product but cost_price stays 0 until owner sets it
    const cost = session.role === 'owner' ? (parseFloat(cost_price) || 0) : 0;

    const r = db.prepare('INSERT INTO products (name, selling_price, cost_price, stock) VALUES (?,?,?,?)')
      .run(name, parseFloat(selling_price), cost, parseInt(stock) || 0);
    return res.json({ id: r.lastInsertRowid });
  }

  res.status(405).end();
}
