import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const rows = await db.query('SELECT * FROM repairs ORDER BY created_at DESC LIMIT 200');
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { customer_name, customer_phone, phone_model = '—', issue, customer_price = 0, status = 'Pending', payment_method = 'Cash' } = req.body;
    if (!customer_name || !customer_phone || !issue) return res.status(400).json({ error: 'Customer name, phone number, and issue are required' });
    const { lastId } = await db.run(
      'INSERT INTO repairs (customer_name,customer_phone,phone_model,issue,customer_price,status,payment_method,user_id) VALUES (?,?,?,?,?,?,?,?)',
      [customer_name, customer_phone, phone_model, issue, Number(customer_price), status, payment_method, session.id]
    );
    return res.json({ ok: true, id: lastId });
  }

  res.status(405).end();
}
