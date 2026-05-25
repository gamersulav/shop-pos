import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const filter = req.query.filter || 'recent';
    const expand = req.query.expand || '';
    let dateClause = '1=1';
    if (filter === 'today') dateClause = `date(s.created_at,'+5 hours','+45 minutes')=date('now','+5 hours','+45 minutes')`;
    if (filter === 'week')  dateClause = `date(s.created_at,'+5 hours','+45 minutes')>=date('now','-6 days','+5 hours','+45 minutes')`;
    if (filter === 'month') dateClause = `strftime('%Y-%m',s.created_at,'+5 hours','+45 minutes')=strftime('%Y-%m','now','+5 hours','+45 minutes')`;

    if (expand === 'items') {
      const rows = await db.query(
        `SELECT si.id, si.product_name, si.quantity, si.unit_price,
                COALESCE(si.cost_price,0) as cost_price,
                COALESCE(si.item_discount,0) as item_discount,
                CASE WHEN si.product_id IS NULL THEN 'phone' ELSE 'accessory' END as item_type,
                s.id as sale_id, s.payment_method, s.split_payments, s.created_at,
                s.customer_name, s.credit_customer, s.credit_cleared
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE ${dateClause}
         ORDER BY s.created_at DESC, si.id ASC${filter === 'recent' ? ' LIMIT 500' : ''}`
      );
      return res.json(rows);
    }

    const sales = await db.query(
      `SELECT s.*, u.username,
              GROUP_CONCAT(si.product_name || ' x' || si.quantity) as items_summary
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE ${dateClause}
       GROUP BY s.id ORDER BY s.created_at DESC${filter === 'recent' ? ' LIMIT 100' : ''}`
    );
    return res.json(sales);
  }

  if (req.method === 'POST') {
    const { items, payment, splitPayments = null, creditCustomer = '', creditCustomerPhone = '', customerName = '', customerPhone = '', loyaltyDiscount = 0 } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'No items' });
    if (!payment) return res.status(400).json({ error: 'Payment method required' });

    const saleId = await db.tx(async (tx) => {
      const itemsTotal = items.reduce((s, i) => {
        const lineTotal = Number(i.price) * (Number(i.qty) || 1) - (Number(i.itemDiscount) || 0);
        return s + Math.max(0, lineTotal);
      }, 0);
      const loyaltyDisc = Math.max(0, Math.min(Number(loyaltyDiscount) || 0, itemsTotal));
      const total = Math.max(0, itemsTotal - loyaltyDisc);
      const discAmt = items.reduce((s, i) => s + Math.max(0, Number(i.itemDiscount) || 0), 0);
      const splitJson = splitPayments?.length > 1 ? JSON.stringify(splitPayments) : null;

      const { lastId } = await tx.run(
        'INSERT INTO sales (payment_method,total_amount,discount_amount,loyalty_discount,credit_customer,credit_customer_phone,customer_name,customer_phone,split_payments,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [payment, total, discAmt, loyaltyDisc, payment === 'Credit' ? creditCustomer : '', payment === 'Credit' ? creditCustomerPhone : '', customerName, customerPhone, splitJson, session.id]
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
          if (prod && prod.stock < qty) throw new Error(`Not enough stock for ${prod.name}. Only ${prod.stock} available.`);
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
