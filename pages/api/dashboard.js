import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();

  // ── Today ─────────────────────────────────────────────────────────────────
  const today = await db.queryOne(`
    SELECT COALESCE(SUM(s.total_amount),0) as revenue,
           COUNT(DISTINCT s.id)            as sales,
           COALESCE(SUM(si.quantity),0)    as items
    FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id
    WHERE date(s.created_at)=date('now')`);

  const todayProfit = await db.queryOne(`
    SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price)),0) as profit
    FROM sales s JOIN sale_items si ON si.sale_id=s.id
    WHERE date(s.created_at)=date('now')`);

  // ── This month ────────────────────────────────────────────────────────────
  const monthly = await db.queryOne(`
    SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as sales
    FROM sales WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')`);

  const monthlyProfit = await db.queryOne(`
    SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price)),0) as profit
    FROM sales s JOIN sale_items si ON si.sale_id=s.id
    WHERE strftime('%Y-%m',s.created_at)=strftime('%Y-%m','now')`);

  // ── Payment breakdown today ───────────────────────────────────────────────
  const payments = await db.query(`
    SELECT payment_method as method, COUNT(*) as count, SUM(total_amount) as total
    FROM sales WHERE date(created_at)=date('now')
    GROUP BY payment_method ORDER BY total DESC`);

  // ── Top products this month ───────────────────────────────────────────────
  const topProducts = await db.query(`
    SELECT si.product_name as name,
           SUM(si.quantity) as qty,
           SUM(si.quantity*si.unit_price) as revenue,
           SUM(si.quantity*(si.unit_price-si.cost_price)) as profit
    FROM sales s JOIN sale_items si ON si.sale_id=s.id
    WHERE strftime('%Y-%m',s.created_at)=strftime('%Y-%m','now')
    GROUP BY si.product_name ORDER BY qty DESC LIMIT 6`);

  // ── Repairs ───────────────────────────────────────────────────────────────
  const repairStats = await db.query(
    `SELECT status, COUNT(*) as count FROM repairs GROUP BY status`);

  const activeRepairs = await db.query(
    `SELECT * FROM repairs WHERE status IN ('Pending','In Progress') ORDER BY created_at ASC LIMIT 15`);

  // ── Used phones ───────────────────────────────────────────────────────────
  const phoneStats = await db.queryOne(`
    SELECT
      COUNT(CASE WHEN status='available' THEN 1 END) as available,
      COUNT(CASE WHEN status='sold' AND strftime('%Y-%m',sold_at)=strftime('%Y-%m','now') THEN 1 END) as sold_month,
      COALESCE(SUM(CASE WHEN status='sold' AND strftime('%Y-%m',sold_at)=strftime('%Y-%m','now') THEN selling_price-cost_price END),0) as phone_profit_month,
      COUNT(CASE WHEN status='available' AND selling_price=0 THEN 1 END) as needs_pricing
    FROM used_phones`);

  const rev    = Number(monthly?.revenue || 0);
  const profit = Number(monthlyProfit?.profit || 0);

  res.json({
    today: {
      revenue: Number(today?.revenue || 0),
      profit:  Number(todayProfit?.profit || 0),
      sales:   Number(today?.sales  || 0),
      items:   Number(today?.items  || 0),
    },
    monthly: {
      revenue: rev,
      profit,
      sales:  Number(monthly?.sales || 0),
      margin: rev > 0 ? (profit / rev) * 100 : 0,
    },
    payments,
    topProducts,
    repairStats,
    activeRepairs,
    phoneStats: {
      available:         Number(phoneStats?.available || 0),
      soldThisMonth:     Number(phoneStats?.sold_month || 0),
      profitThisMonth:   Number(phoneStats?.phone_profit_month || 0),
      needsPricing:      Number(phoneStats?.needs_pricing || 0),
    },
  });
}
