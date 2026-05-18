import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ repairs: [], sales: [] });

  const db = await getDb();
  const like = `%${q}%`;

  const [repairs, sales] = await Promise.all([
    db.query(
      `SELECT id, customer_name, customer_phone, phone_model, issue, customer_price,
              repair_discount, payment_method, status, created_at
       FROM repairs WHERE customer_name LIKE ? OR customer_phone LIKE ?
       ORDER BY created_at DESC LIMIT 30`,
      [like, like]
    ),
    db.query(
      `SELECT s.id, s.credit_customer as customer_name, s.total_amount,
              s.credit_discount, s.credit_cleared, s.created_at,
              GROUP_CONCAT(si.product_name || ' x' || si.quantity, ', ') as items
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       WHERE s.payment_method='Credit' AND s.credit_customer LIKE ?
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 20`,
      [like]
    ),
  ]);

  res.json({ repairs, sales });
}
