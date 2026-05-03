import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = getDb();

  // Today stats
  const today = db.prepare(`
    SELECT
      COALESCE(SUM(s.total_amount), 0) as revenue,
      COUNT(DISTINCT s.id)             as sales,
      COALESCE(SUM(si.quantity), 0)    as items
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE date(s.created_at) = date('now','localtime')
  `).get();

  const todayProfit = db.prepare(`
    SELECT COALESCE(SUM(si.quantity * (si.unit_price - COALESCE(p.cost_price, 0))), 0) as profit
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE date(s.created_at) = date('now','localtime')
  `).get();

  // Monthly stats
  const monthly = db.prepare(`
    SELECT
      COALESCE(SUM(s.total_amount), 0) as revenue,
      COUNT(DISTINCT s.id)             as sales
    FROM sales s
    WHERE strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now','localtime')
  `).get();

  const monthlyProfit = db.prepare(`
    SELECT COALESCE(SUM(si.quantity * (si.unit_price - COALESCE(p.cost_price, 0))), 0) as profit
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now','localtime')
  `).get();

  // Payment breakdown today
  const payments = db.prepare(`
    SELECT payment_method as method, COUNT(*) as count, SUM(total_amount) as total
    FROM sales
    WHERE date(created_at) = date('now','localtime')
    GROUP BY payment_method
    ORDER BY total DESC
  `).all();

  // Top products this month
  const topProducts = db.prepare(`
    SELECT
      si.product_name     as name,
      SUM(si.quantity)    as qty,
      SUM(si.quantity * si.unit_price) as revenue,
      SUM(si.quantity * (si.unit_price - COALESCE(p.cost_price, 0))) as profit
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now','localtime')
    GROUP BY si.product_name
    ORDER BY qty DESC
    LIMIT 5
  `).all();

  // Pending repairs
  const pendingRepairs = db.prepare(`
    SELECT * FROM repairs WHERE status IN ('Pending','In Progress') ORDER BY created_at DESC LIMIT 10
  `).all();

  const rev = monthly.revenue || 0;
  const profit = monthlyProfit.profit || 0;

  res.json({
    today: {
      revenue: today.revenue,
      profit: todayProfit.profit,
      sales: today.sales,
      items: today.items,
    },
    weekly: {},
    monthly: {
      revenue: rev,
      profit,
      sales: monthly.sales,
      margin: rev > 0 ? (profit / rev) * 100 : 0,
    },
    payments,
    topProducts,
    pendingRepairs,
  });
}
