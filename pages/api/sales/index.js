import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const sales = await db.query(
      `SELECT s.*, GROUP_CONCAT(si.product_name || ' x' || si.quantity) as items_summary
       FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 100`
    );
    return res.json(sales);
  }

  if (req.method === 'POST') {
    const { items, payment, creditCustomer = '' } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No items' });
    if (!payment) return res.status(400).json({ error: 'Payment method required' });

    const saleId = await db.tx(async (tx) => {
      const total = items.reduce((s, i) => {
        const lineTotal = Number(i.price) * (Number(i.qty) || 1) - (Number(i.itemDiscount) || 0);
        return s + Math.max(0, lineTotal);
      }, 0);
      const discAmt = items.reduce((s, i) => s + Math.max(0, Number(i.itemDiscount) || 0), 0);

      const { lastId } = await tx.run(
        'INSERT INTO sales (payment_method,total_amount,discount_amount,credit_customer,user_id) VALUES (?,?,?,?,?)',
        [payment, total, discAmt, payment === 'Credit' ? creditCustomer : '', session.id]
      );

      for (const item of items) {
        if (item.type === 'phone') {
          const phone = await tx.queryOne('SELECT * FROM used_phones WHERE id=?', [Number(item.phoneId)]);
          if (!phone) continue;
          if (phone.status === 'sold') throw new Error(`${phone.model} already sold`);
          const disc = Math.min(Math.max(0, Number(item.itemDiscount) || 0), Number(phone.selling_price));
          await tx.run(
            'INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price,item_discount) VALUES (?,?,?,?,?,?,?)',
            [lastId, null, phone.model, 1, Number(phone.selling_price), Number(phone.cost_price), disc]
          );
          await tx.run(
            "UPDATE used_phones SET status='sold', sold_in_sale=?, sold_at=datetime('now') WHERE id=?",
            [lastId, Number(item.phoneId)]
          );
        } else {
          const pid = Number(item.productId);
          const qty = Number(item.qty) || 1;
          const disc = Math.max(0, Number(item.itemDiscount) || 0);
          const prod = await tx.queryOne('SELECT * FROM products WHERE id=?', [pid]);
          await tx.run(
            'INSERT INTO sale_items (sale_id,product_id,product_name,quantity,unit_price,cost_price,item_discount) VALUES (?,?,?,?,?,?,?)',
            [lastId, pid, prod ? prod.name : 'Unknown', qty, Number(item.price), prod ? Number(prod.cost_price) : 0, disc]
          );
          if (prod) await tx.run('UPDATE products SET stock=stock-? WHERE id=?', [qty, pid]);
        }
      }
      return lastId;
    });

    return res.json({ ok: true, id: saleId });
  }

  res.status(405).end();
}
