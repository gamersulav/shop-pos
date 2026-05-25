import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    const slim = req.query.slim === '1';
    if (session.role === 'owner') {
      const phones = await db.query(`
        SELECT up.*, COALESCE(si.item_discount, 0) as sale_discount
        FROM used_phones up
        LEFT JOIN sale_items si ON si.sale_id = up.sold_in_sale AND si.product_id IS NULL
        ORDER BY up.created_at DESC
      `);
      return res.json(slim ? phones.map(({ photos, ...p }) => p) : phones);
    }
    // Staff: see all phones but hide cost_price
    const phones = await db.query("SELECT * FROM used_phones ORDER BY created_at DESC");
    return res.json(phones.map(({ cost_price, photos, ...p }) => slim ? p : { ...p, photos }));
  }

  if (req.method === 'POST') {
    const { model, condition = 'Good', notes = '', photos = null, cost_price = 0, color = '', imei = '' } = req.body;
    if (!model?.trim())  return res.status(400).json({ error: 'Phone model is required' });
    if (!color?.trim())  return res.status(400).json({ error: 'Color is required' });
    if (!imei?.trim())   return res.status(400).json({ error: 'IMEI is required' });
    const photosJson = photos?.length ? JSON.stringify(photos) : null;
    const { lastId } = await db.run(
      'INSERT INTO used_phones (model,condition,notes,photos,stocked_by,cost_price,color,imei) VALUES (?,?,?,?,?,?,?,?)',
      [model.trim(), condition, notes, photosJson, session.id, parseFloat(cost_price) || 0, color.trim(), imei.trim()]
    );
    return res.json({ ok: true, id: lastId });
  }

  res.status(405).end();
}
