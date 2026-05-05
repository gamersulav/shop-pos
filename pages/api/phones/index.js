import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    if (session.role === 'owner') {
      const phones = await db.query('SELECT * FROM used_phones ORDER BY created_at DESC');
      return res.json(phones);
    }
    // Staff: see all phones but hide cost_price
    const phones = await db.query("SELECT * FROM used_phones ORDER BY created_at DESC");
    return res.json(phones.map(({ cost_price, ...p }) => p));
  }

  if (req.method === 'POST') {
    const { model, condition = 'Good', notes = '', photos = null } = req.body;
    if (!model?.trim()) return res.status(400).json({ error: 'Phone model is required' });
    const photosJson = photos?.length ? JSON.stringify(photos) : null;
    const { lastId } = await db.run(
      'INSERT INTO used_phones (model,condition,notes,photos,stocked_by) VALUES (?,?,?,?,?)',
      [model.trim(), condition, notes, photosJson, session.id]
    );
    return res.json({ ok: true, id: lastId });
  }

  res.status(405).end();
}
