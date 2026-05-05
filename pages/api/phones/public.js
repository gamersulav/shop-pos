import { getDb } from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const db = await getDb();
  const phones = await db.query(
    "SELECT id,model,condition,selling_price,notes FROM used_phones WHERE status='available' AND selling_price>0 ORDER BY created_at DESC"
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json(phones);
}
