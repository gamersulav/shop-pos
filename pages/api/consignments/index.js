import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  if (req.method === 'GET') {
    const { status } = req.query;
    let where = '1=1';
    const args = [];
    if (status && status !== 'all') { where = 'c.status=?'; args.push(status); }
    const rows = await db.query(
      `SELECT c.*, u.username as given_by_name
       FROM consignments c
       LEFT JOIN users u ON u.id = c.given_by
       WHERE ${where}
       ORDER BY c.given_at DESC`,
      args
    );
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { person_name, person_phone = '', item_name, quantity = 1, unit_price = 0, notes = '', phone_id, product_id } = req.body;
    if (!person_name?.trim()) return res.status(400).json({ error: 'Person name required' });
    if (!item_name?.trim())   return res.status(400).json({ error: 'Item name required' });

    await db.tx(async tx => {
      await tx.run(
        `INSERT INTO consignments (person_name,person_phone,item_name,quantity,unit_price,notes,given_by,phone_id,product_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [person_name.trim(), person_phone.trim(), item_name.trim(),
         Number(quantity)||1, Number(unit_price)||0, notes.trim(),
         session.id, phone_id ? Number(phone_id) : null, product_id ? Number(product_id) : null]
      );
      if (phone_id)   await tx.run(`UPDATE used_phones SET status='consignment' WHERE id=?`, [Number(phone_id)]);
      if (product_id) await tx.run(`UPDATE products SET stock=stock-? WHERE id=?`, [Number(quantity)||1, Number(product_id)]);
    });

    return res.json({ ok: true });
  }

  res.status(405).end();
}
