import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'PUT') {
    const { status, amount_received, notes, payment_method = 'Cash' } = req.body;
    if (!['sold', 'returned', 'out'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const c = await db.queryOne('SELECT * FROM consignments WHERE id=?', [id]);
    if (!c) return res.status(404).json({ error: 'Not found' });

    if (status === 'sold') {
      const amt   = Number(amount_received) || 0;
      const qty   = Number(c.quantity) || 1;
      const uPrice = qty > 0 ? amt / qty : amt;
      const pm = payment_method || 'Cash';

      await db.tx(async tx => {
        let costPrice = 0;

        if (c.phone_id) {
          const phone = await tx.queryOne('SELECT * FROM used_phones WHERE id=?', [Number(c.phone_id)]);
          costPrice = phone ? Number(phone.cost_price) || 0 : 0;

          const { lastId: saleId } = await tx.run(
            `INSERT INTO sales (payment_method,total_amount,discount_amount,customer_name,customer_phone,user_id) VALUES (?,?,0,?,?,?)`,
            [pm, amt, c.person_name, c.person_phone || '', session.id]
          );
          await tx.run(
            `INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price,item_discount)
             VALUES (?,NULL,?,1,?,?,0)`,
            [saleId, c.item_name, amt, costPrice]
          );
          await tx.run(
            `UPDATE used_phones SET status='sold', sold_in_sale=?, sold_at=datetime('now') WHERE id=?`,
            [saleId, Number(c.phone_id)]
          );
        } else if (c.product_id) {
          const prod = await tx.queryOne('SELECT * FROM products WHERE id=?', [Number(c.product_id)]);
          costPrice = prod ? Number(prod.cost_price) || 0 : 0;

          const { lastId: saleId } = await tx.run(
            `INSERT INTO sales (payment_method,total_amount,discount_amount,customer_name,customer_phone,user_id) VALUES (?,?,0,?,?,?)`,
            [pm, amt, c.person_name, c.person_phone || '', session.id]
          );
          await tx.run(
            `INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price,item_discount)
             VALUES (?,?,?,?,?,?,0)`,
            [saleId, Number(c.product_id), c.item_name, qty, uPrice, costPrice]
          );
        } else {
          const { lastId: saleId } = await tx.run(
            `INSERT INTO sales (payment_method,total_amount,discount_amount,customer_name,customer_phone,user_id) VALUES (?,?,0,?,?,?)`,
            [pm, amt, c.person_name, c.person_phone || '', session.id]
          );
          await tx.run(
            `INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price,item_discount)
             VALUES (?,NULL,?,1,?,0,0)`,
            [saleId, c.item_name, amt]
          );
        }

        await tx.run(
          `UPDATE consignments SET status='sold', amount_received=?, notes=COALESCE(?,notes), resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
          [amt, notes ?? null, session.id, id]
        );
      });

      return res.json({ ok: true });
    }

    if (status === 'returned') {
      await db.tx(async tx => {
        if (c.phone_id)   await tx.run(`UPDATE used_phones SET status='available', sold_in_sale=NULL, sold_at=NULL WHERE id=? AND status='consignment'`, [Number(c.phone_id)]);
        if (c.product_id) await tx.run(`UPDATE products SET stock=stock+? WHERE id=?`, [Number(c.quantity)||1, Number(c.product_id)]);
        await tx.run(
          `UPDATE consignments SET status='returned', amount_received=0, notes=COALESCE(?,notes), resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
          [notes ?? null, session.id, id]
        );
      });
      return res.json({ ok: true });
    }

    await db.run(
      `UPDATE consignments SET status=?, amount_received=?, notes=COALESCE(?,notes), resolved_at=NULL, resolved_by=NULL WHERE id=?`,
      [status, Number(amount_received)||0, notes ?? null, id]
    );
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const c = await db.queryOne('SELECT * FROM consignments WHERE id=?', [id]);
    if (c) {
      if (c.phone_id && c.status === 'consignment')
        await db.run(`UPDATE used_phones SET status='available' WHERE id=? AND status='consignment'`, [Number(c.phone_id)]);
      if (c.product_id && c.status === 'out')
        await db.run(`UPDATE products SET stock=stock+? WHERE id=?`, [Number(c.quantity)||1, Number(c.product_id)]);
    }
    await db.run(`DELETE FROM consignments WHERE id=?`, [id]);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
