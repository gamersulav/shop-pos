import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'DELETE') {
    await db.tx(async tx => {
      const saleItems = await tx.query('SELECT * FROM sale_items WHERE sale_id=?', [id]);

      for (const si of saleItems) {
        if (si.product_id) {
          await tx.run('UPDATE products SET stock=stock+? WHERE id=?', [Number(si.quantity) || 1, si.product_id]);
        } else {
          // Phone — find by sold_in_sale and restore
          const phone = await tx.queryOne('SELECT id FROM used_phones WHERE sold_in_sale=?', [id]);
          if (phone) {
            await tx.run(
              "UPDATE used_phones SET status='available', sold_in_sale=NULL, sold_at=NULL WHERE id=?",
              [phone.id]
            );
          }
        }
      }

      await tx.run('DELETE FROM sale_items WHERE sale_id=?', [id]);
      await tx.run('DELETE FROM sales WHERE id=?', [id]);
    });

    return res.json({ ok: true });
  }

  res.status(405).end();
}
