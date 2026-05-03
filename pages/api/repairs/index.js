import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = getDb();

  if (req.method === 'GET') {
    const rows = db.prepare('SELECT * FROM repairs ORDER BY created_at DESC LIMIT 200').all();
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { customer_name, phone_model, issue, customer_price = 0, status = 'Pending' } = req.body;
    if (!customer_name || !phone_model || !issue) return res.status(400).json({ error: 'Missing fields' });

    const r = db.prepare('INSERT INTO repairs (customer_name, phone_model, issue, customer_price, status, user_id) VALUES (?,?,?,?,?,?)')
      .run(customer_name, phone_model, issue, Number(customer_price), status, session.id);
    return res.json({ ok: true, id: r.lastInsertRowid });
  }

  res.status(405).end();
}
