import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'PUT') {
    const { selling_price, cost_price, stock, name, category_id } = req.body;
    const fields = [], vals = [];
    if (name           !== undefined) { fields.push('name=?');          vals.push(name); }
    if (selling_price  !== undefined) { fields.push('selling_price=?'); vals.push(Number(selling_price)); }
    if (cost_price     !== undefined) { fields.push('cost_price=?');    vals.push(Number(cost_price)); }
    if (stock          !== undefined) { fields.push('stock=?');         vals.push(Number(stock)); }
    if (req.body.photo !== undefined) { fields.push('photo=?');         vals.push(req.body.photo || null); }
    if (category_id    !== undefined) { fields.push('category_id=?');   vals.push(category_id ? parseInt(category_id) : null); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(id);
    await db.run(`UPDATE products SET ${fields.join(',')} WHERE id=?`, vals);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await db.run('UPDATE products SET active=0 WHERE id=?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
