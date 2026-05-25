import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'GET') {
    const customer = await db.queryOne('SELECT * FROM customers WHERE id=?', [id]);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const events = await db.query(
      'SELECT * FROM loyalty_events WHERE customer_id=? ORDER BY created_at DESC LIMIT 50',
      [id]
    );
    return res.json({ ...customer, events });
  }

  if (req.method === 'PUT') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const { name, phone, tier, points_adjust, notes } = req.body;

    const customer = await db.queryOne('SELECT * FROM customers WHERE id=?', [id]);
    if (!customer) return res.status(404).json({ error: 'Not found' });

    const fields = [], vals = [];
    if (name  !== undefined) { fields.push('name=?');  vals.push(name.trim()); }
    if (phone !== undefined) { fields.push('phone=?'); vals.push(phone.trim()); }
    if (tier  !== undefined) { fields.push('tier=?');  vals.push(tier); }
    if (notes !== undefined) { fields.push('notes=?'); vals.push(notes); }

    if (points_adjust !== undefined && Number(points_adjust) !== 0) {
      const adj = Number(points_adjust);
      const newPoints = Math.max(0, Number(customer.points) + adj);
      fields.push('points=?');
      vals.push(newPoints);
      await db.run(
        `INSERT INTO loyalty_events (customer_id, type, points, note) VALUES (?, 'manual', ?, ?)`,
        [id, adj, `Manual adjustment by owner`]
      );
    }

    if (fields.length) {
      vals.push(id);
      await db.run(`UPDATE customers SET ${fields.join(',')} WHERE id=?`, vals);
    }

    return res.json({ ok: true });
  }

  res.status(405).end();
}
