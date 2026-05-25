import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();
  const id = Number(req.query.id);

  if (req.method === 'PUT') {
    const { customer_price, cost_price, status, notes, payment_method, repair_discount,
            customer_name, customer_phone, phone_model, issue } = req.body;
    const fields = [], vals = [];
    if (status !== undefined) {
      fields.push('status=?'); vals.push(status);
      const tsMap = { 'In Progress': 'in_progress_at', 'Done': 'done_at', 'Delivered': 'delivered_at', 'Returned': 'returned_at' };
      const tsCol = tsMap[status];
      if (tsCol) fields.push(`${tsCol}=datetime('now')`);
    }
    if (notes           !== undefined) { fields.push('notes=?');           vals.push(notes); }
    if (payment_method  !== undefined) { fields.push('payment_method=?');  vals.push(payment_method); }
    if (repair_discount !== undefined) { fields.push('repair_discount=?'); vals.push(Math.max(0, Number(repair_discount))); }
    if (session.role === 'owner') {
      if (customer_price  !== undefined) { fields.push('customer_price=?');  vals.push(Number(customer_price)); }
      if (cost_price      !== undefined) { fields.push('cost_price=?');      vals.push(Number(cost_price)); }
      if (customer_name   !== undefined) { fields.push('customer_name=?');   vals.push(customer_name); }
      if (customer_phone  !== undefined) { fields.push('customer_phone=?');  vals.push(customer_phone); }
      if (phone_model     !== undefined) { fields.push('phone_model=?');     vals.push(phone_model); }
      if (issue           !== undefined) { fields.push('issue=?');           vals.push(issue); }
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(id);
    await db.run(`UPDATE repairs SET ${fields.join(',')} WHERE id=?`, vals);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
