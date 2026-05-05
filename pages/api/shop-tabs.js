import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const all = req.query.all === '1';
    const rows = await db.query(
      all
        ? `SELECT * FROM shop_tabs ORDER BY shop_name, created_at DESC`
        : `SELECT * FROM shop_tabs WHERE settled=0 ORDER BY shop_name, created_at DESC`
    );
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { shopName, direction = 'in', items } = req.body;
    if (!shopName?.trim() || !items?.length) {
      return res.status(400).json({ error: 'Shop name and items required' });
    }
    const dir = direction === 'out' ? 'out' : 'in';
    for (const item of items) {
      if (!item.productName || !item.quantity) continue;
      await db.run(
        'INSERT INTO shop_tabs (shop_name,direction,product_id,product_name,quantity,unit_cost,user_id) VALUES (?,?,?,?,?,?,?)',
        [shopName.trim(), dir, item.productId || null, item.productName, Number(item.quantity), Number(item.unitCost) || 0, session.id]
      );
      if (item.productId) {
        // 'in' = we bought from them → increase our stock
        // 'out' = they took from us → decrease our stock
        const stockDelta = dir === 'out' ? -Number(item.quantity) : Number(item.quantity);
        await db.run('UPDATE products SET stock=stock+? WHERE id=?', [stockDelta, Number(item.productId)]);
      }
    }
    return res.json({ ok: true });
  }

  if (req.method === 'PUT') {
    const { shopName } = req.body;
    if (!shopName) return res.status(400).json({ error: 'Shop name required' });
    await db.run(
      "UPDATE shop_tabs SET settled=1, settled_at=datetime('now') WHERE shop_name=? AND settled=0",
      [shopName]
    );
    return res.json({ ok: true });
  }

  res.status(405).end();
}
