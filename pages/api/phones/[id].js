import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const id = Number(req.query.id);

  // ── Owner: update prices ──────────────────────────────────────────────────
  if (req.method === 'PUT') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const { cost_price, selling_price, condition, notes } = req.body;
    const fields = [], vals = [];
    if (cost_price    !== undefined) { fields.push('cost_price=?');    vals.push(Number(cost_price)); }
    if (selling_price !== undefined) { fields.push('selling_price=?'); vals.push(Number(selling_price)); }
    if (condition     !== undefined) { fields.push('condition=?');     vals.push(condition); }
    if (notes         !== undefined) { fields.push('notes=?');         vals.push(notes); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(id);
    await db.run(`UPDATE used_phones SET ${fields.join(',')} WHERE id=?`, vals);
    return res.json({ ok: true });
  }

  // ── Staff: sell a phone ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { payment } = req.body;
    if (!payment) return res.status(400).json({ error: 'Payment method required' });

    const phone = await db.queryOne('SELECT * FROM used_phones WHERE id=?', [id]);
    if (!phone) return res.status(404).json({ error: 'Phone not found' });
    if (phone.status === 'sold') return res.status(400).json({ error: 'Phone already sold' });
    if (!Number(phone.selling_price)) return res.status(400).json({ error: 'Phone not priced yet' });

    const saleId = await db.tx(async (tx) => {
      const { lastId } = await tx.run(
        'INSERT INTO sales (payment_method,total_amount,user_id) VALUES (?,?,?)',
        [payment, Number(phone.selling_price), session.id]
      );
      await tx.run(
        'INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price) VALUES (?,?,?,?,?,?)',
        [lastId, null, phone.model, 1, Number(phone.selling_price), Number(phone.cost_price)]
      );
      await tx.run(
        "UPDATE used_phones SET status='sold', sold_in_sale=?, sold_at=datetime('now') WHERE id=?",
        [lastId, id]
      );
      return lastId;
    });

    return res.json({ ok: true, saleId });
  }

  // ── Owner: delete phone entry ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    await db.run('DELETE FROM used_phones WHERE id=?', [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
