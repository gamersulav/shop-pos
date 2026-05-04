import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = await getDb();

  if (req.method === 'GET') {
    const rows = await db.query(
      'SELECT sr.*, u.username FROM sales_returns sr LEFT JOIN users u ON u.id=sr.user_id ORDER BY sr.created_at DESC LIMIT 100'
    );
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { itemType = 'product', itemId, itemName, quantity = 1, reason = '' } = req.body;
    if (!itemId || !itemName) return res.status(400).json({ error: 'Item required' });

    await db.tx(async (tx) => {
      await tx.run(
        'INSERT INTO sales_returns (item_type,item_id,item_name,quantity,reason,user_id) VALUES (?,?,?,?,?,?)',
        [itemType, Number(itemId), itemName, Number(quantity), reason, session.id]
      );
      if (itemType === 'product') {
        await tx.run('UPDATE products SET stock=stock+? WHERE id=?', [Number(quantity), Number(itemId)]);
      } else if (itemType === 'phone') {
        await tx.run(
          "UPDATE used_phones SET status='available', sold_in_sale=NULL, sold_at=NULL WHERE id=?",
          [Number(itemId)]
        );
      }
    });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
