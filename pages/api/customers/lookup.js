import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'Query required' });

  const customer = await db.queryOne(
    'SELECT * FROM customers WHERE phone=? OR card_number=?',
    [q.trim(), q.trim().toUpperCase()]
  );
  if (!customer) return res.status(404).json({ error: 'Not found' });
  return res.json(customer);
}
