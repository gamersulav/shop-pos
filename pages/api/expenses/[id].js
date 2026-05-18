import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'DELETE') {
    const expense = await db.queryOne('SELECT * FROM expenses WHERE id=?', [id]);
    if (!expense) return res.status(404).json({ error: 'Not found' });
    if (session.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can delete expenses' });
    }
    await db.run('DELETE FROM expenses WHERE id=?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
