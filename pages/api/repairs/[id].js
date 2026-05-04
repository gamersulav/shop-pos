import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'PUT') {
    const { customer_price, cost_price, status, notes } = req.body;
    const fields = [], vals = [];
    // Staff can update status and notes; owner can also update prices
    if (status !== undefined) { fields.push('status=?'); vals.push(status); }
    if (notes  !== undefined) { fields.push('notes=?');  vals.push(notes); }
    if (session.role === 'owner') {
      if (customer_price !== undefined) { fields.push('customer_price=?'); vals.push(Number(customer_price)); }
      if (cost_price     !== undefined) { fields.push('cost_price=?');     vals.push(Number(cost_price)); }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(id);
    await db.run(`UPDATE repairs SET ${fields.join(',')} WHERE id=?`, vals);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
