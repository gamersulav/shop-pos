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

    const phone = await db.queryOne('SELECT sold_in_sale FROM used_phones WHERE id=?', [id]);
    vals.push(id);
    await db.run(`UPDATE used_phones SET ${fields.join(',')} WHERE id=?`, vals);

    // Sync sale_items and sales if this phone has been sold
    if (phone?.sold_in_sale && (selling_price !== undefined || cost_price !== undefined)) {
      const siFields = [], siVals = [];
      if (selling_price !== undefined) { siFields.push('unit_price=?');  siVals.push(Number(selling_price)); }
      if (cost_price    !== undefined) { siFields.push('cost_price=?');  siVals.push(Number(cost_price)); }
      siVals.push(phone.sold_in_sale);
      await db.run(`UPDATE sale_items SET ${siFields.join(',')} WHERE sale_id=? AND product_id IS NULL`, siVals);

      if (selling_price !== undefined) {
        const si = await db.queryOne('SELECT COALESCE(item_discount,0) as disc FROM sale_items WHERE sale_id=? AND product_id IS NULL', [phone.sold_in_sale]);
        await db.run('UPDATE sales SET total_amount=? WHERE id=?', [Math.max(0, Number(selling_price) - Number(si?.disc || 0)), phone.sold_in_sale]);
      }
    }

    return res.json({ ok: true });
  }

  // ── Staff: sell a phone ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { payment, discount = 0, creditCustomer = '' } = req.body;
    if (!payment) return res.status(400).json({ error: 'Payment method required' });

    const phone = await db.queryOne('SELECT * FROM used_phones WHERE id=?', [id]);
    if (!phone) return res.status(404).json({ error: 'Phone not found' });
    if (phone.status === 'sold') return res.status(400).json({ error: 'Phone already sold' });
    if (!Number(phone.selling_price)) return res.status(400).json({ error: 'Phone not priced yet' });

    const discAmt  = Math.min(Math.max(0, Number(discount)), Number(phone.selling_price));
    const saleTotal = Number(phone.selling_price) - discAmt;

    const saleId = await db.tx(async (tx) => {
      const { lastId } = await tx.run(
        'INSERT INTO sales (payment_method,total_amount,discount_amount,credit_customer,user_id) VALUES (?,?,?,?,?)',
        [payment, saleTotal, discAmt, payment === 'Credit' ? creditCustomer : '', session.id]
      );
      await tx.run(
        'INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price,item_discount) VALUES (?,?,?,?,?,?,?)',
        [lastId, null, phone.model, 1, Number(phone.selling_price), Number(phone.cost_price), discAmt]
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
