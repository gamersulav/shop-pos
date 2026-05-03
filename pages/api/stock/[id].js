import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = getDb();
  const id = Number(req.query.id);

  if (req.method === 'PUT') {
    const { cost_price } = req.body;
    db.prepare('UPDATE stock_entries SET cost_price=? WHERE id=?').run(Number(cost_price), id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
