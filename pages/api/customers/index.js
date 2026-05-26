import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const { q = '', limit = 200 } = req.query;
    const search = `%${q}%`;
    const rows = q
      ? await db.query(
          `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR card_number LIKE ? ORDER BY name ASC LIMIT ?`,
          [search, search, search, Number(limit)]
        )
      : await db.query(`SELECT * FROM customers ORDER BY joined_at DESC LIMIT ?`, [Number(limit)]);
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { name, phone, notes = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (!phone?.trim()) return res.status(400).json({ error: 'Phone required' });

    const existing = await db.queryOne('SELECT id FROM customers WHERE phone=?', [phone.trim()]);
    if (existing) return res.status(409).json({ error: 'Phone already registered' });

    const issued_by = session.username || session.role || 'Unknown';
    const { lastId } = await db.run(
      `INSERT INTO customers (card_number, name, phone, notes, issued_by) VALUES ('TEMP', ?, ?, ?, ?)`,
      [name.trim(), phone.trim(), notes.trim(), issued_by]
    );
    const card_number = `AES-${String(lastId).padStart(4, '0')}`;
    await db.run('UPDATE customers SET card_number=? WHERE id=?', [card_number, lastId]);
    const customer = await db.queryOne('SELECT * FROM customers WHERE id=?', [lastId]);
    return res.json(customer);
  }

  res.status(405).end();
}
