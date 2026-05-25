import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const { type = 'sales' } = req.query;
  const db = await getDb();

  if (type === 'sales') {
    const rows = await db.query(
      `SELECT s.id, s.payment_method, s.total_amount, s.discount_amount,
              COALESCE(NULLIF(s.customer_name,''), s.credit_customer) as customer,
              s.credit_cleared, s.created_at,
              GROUP_CONCAT(si.product_name || ' x' || si.quantity, '; ') as items
       FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 5000`
    );
    return sendCSV(res, 'sales.csv', toCSV(['id','payment_method','total_amount','discount_amount','customer','credit_cleared','created_at','items'], rows));
  }

  if (type === 'repairs') {
    const rows = await db.query(
      `SELECT id, customer_name, customer_phone, phone_model, issue,
              customer_price, repair_discount, cost_price, status, payment_method,
              created_at, in_progress_at, done_at, delivered_at
       FROM repairs ORDER BY created_at DESC LIMIT 5000`
    );
    return sendCSV(res, 'repairs.csv', toCSV(['id','customer_name','customer_phone','phone_model','issue','customer_price','repair_discount','cost_price','status','payment_method','created_at','in_progress_at','done_at','delivered_at'], rows));
  }

  if (type === 'expenses') {
    const rows = await db.query(
      `SELECT id, description, amount, payment_method, category, expense_date, created_at
       FROM expenses ORDER BY expense_date DESC LIMIT 5000`
    );
    return sendCSV(res, 'expenses.csv', toCSV(['id','description','amount','payment_method','category','expense_date','created_at'], rows));
  }

  return res.status(400).json({ error: 'Invalid type. Use sales, repairs, or expenses.' });
}

function toCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

function sendCSV(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}
