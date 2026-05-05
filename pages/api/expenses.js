import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'GET') {
    const { period, type } = req.query;
    const where = [];

    // Staff only see staff-submitted expenses
    if (session.role === 'staff') {
      where.push("entered_by = 'staff'");
    } else if (type === 'staff') {
      where.push("entered_by = 'staff'");
    } else if (type === 'owner') {
      where.push("entered_by = 'owner'");
    }

    if (period === 'today') {
      where.push("expense_date = date('now', '+5 hours', '+45 minutes')");
    } else if (period === 'month') {
      where.push("strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now', '+5 hours', '+45 minutes')");
    }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = await db.query(`SELECT * FROM expenses ${clause} ORDER BY expense_date DESC, created_at DESC`);
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const { description, amount } = req.body;
    if (!description?.trim() || !amount) return res.status(400).json({ error: 'Description and amount required' });
    const { lastId } = await db.run(
      'INSERT INTO expenses (description, amount, entered_by, user_id) VALUES (?,?,?,?)',
      [description.trim(), Math.abs(Number(amount)), session.role, session.id]
    );
    return res.json({ ok: true, id: lastId });
  }

  res.status(405).end();
}
