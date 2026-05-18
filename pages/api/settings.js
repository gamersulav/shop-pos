import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'key required' });
    const row = await db.queryOne('SELECT value FROM shop_settings WHERE key=?', [key]);
    return res.json({ value: row?.value ?? null });
  }

  if (req.method === 'POST') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await db.run(
      'INSERT INTO shop_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, String(value ?? '')]
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}
