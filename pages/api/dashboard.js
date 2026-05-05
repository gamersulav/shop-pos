import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

// Nepal Standard Time is UTC+5:45
const NPT_TODAY    = "date('now', '+5 hours', '+45 minutes')";
const NPT_MONTH    = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes')";
function nptDate(col)  { return `date(${col}, '+5 hours', '+45 minutes')`; }
function nptMonth(col) { return `strftime('%Y-%m', ${col}, '+5 hours', '+45 minutes')`; }

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
    WHERE ${nptDate('s.created_at')} = ${NPT_TODAY}`);

  const todayProfit = await db.queryOne(`
    SELECT COALESCE(SUM(s.total_amount - ic.cost), 0) as profit
    FROM sales s
    JOIN (SELECT sale_id, SUM(quantity*cost_price) as cost FROM sale_items GROUP BY sale_id) ic ON ic.sale_id=s.id
    WHERE ${nptDate('s.created_at')} = ${NPT_TODAY}`);

  const todayReturns = await db.queryOne(`
    SELECT COALESCE(SUM(return_amount),0) as revenue,
           COALESCE(SUM(return_profit),0) as profit
    FROM sales_returns
    WHERE ${nptDate('created_at')} = ${NPT_TODAY}`);

  // ── This month ────────────────────────────────────────────────────────────
  const monthly = await db.queryOne(`
    SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as sales
    FROM sales WHERE ${nptMonth('created_at')} = ${NPT_MONTH}`);

  const monthlyProfit = await db.queryOne(`
    SELECT COALESCE(SUM(s.total_amount - ic.cost), 0) as profit
    FROM sales s
    JOIN (SELECT sale_id, SUM(quantity*cost_price) as cost FROM sale_items GROUP BY sale_id) ic ON ic.sale_id=s.id
    WHERE ${nptMonth('s.created_at')} = ${NPT_MONTH}`);

  const monthlyReturns = await db.queryOne(`
    SELECT COALESCE(SUM(return_amount),0) as revenue,
           COALESCE(SUM(return_profit),0) as profit
    FROM sales_returns
    WHERE ${nptMonth('created_at')} = ${NPT_MONTH}`);

  // ── Payment breakdown today ───────────────────────────────────────────────
  const payments = await db.query(`
    SELECT payment_method as method, COUNT(*) as count, SUM(total_amount) as total
    FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY}
    GROUP BY payment_method ORDER BY total DESC`);

  // ── Top products this month ───────────────────────────────────────────────
  const topProducts = await db.query(`
    SELECT si.product_name as name,
           SUM(si.quantity) as qty,
           SUM(si.quantity*si.unit_price) as revenue,
           SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)) as profit
    FROM sales s JOIN sale_items si ON si.sale_id=s.id
    WHERE ${nptMonth('s.created_at')} = ${NPT_MONTH}
    GROUP BY si.product_name ORDER BY qty DESC LIMIT 6`);

  // ── Repairs ───────────────────────────────────────────────────────────────
  const repairStats = await db.query(
    `SELECT status, COUNT(*) as count FROM repairs GROUP BY status`);

  const activeRepairs = await db.query(
    `SELECT * FROM repairs WHERE status IN ('Pending','In Progress') ORDER BY created_at ASC LIMIT 15`);

  // ── Used phones ───────────────────────────────────────────────────────────
  const phoneStats = await db.queryOne(`
    SELECT
      COUNT(CASE WHEN up.status='available' THEN 1 END) as available,
      COUNT(CASE WHEN up.status='sold' AND ${nptMonth('up.sold_at')} = ${NPT_MONTH} THEN 1 END) as sold_month,
      COALESCE(SUM(CASE WHEN up.status='sold' AND ${nptMonth('up.sold_at')} = ${NPT_MONTH}
        THEN COALESCE(s.total_amount, up.selling_price) - up.cost_price END), 0) as phone_profit_month,
      COUNT(CASE WHEN up.status='available' AND up.selling_price=0 THEN 1 END) as needs_pricing
    FROM used_phones up
    LEFT JOIN sales s ON s.id = up.sold_in_sale`);

  const todayRev    = Number(today?.revenue    || 0) - Number(todayReturns?.revenue  || 0);
  const todayPro    = Number(todayProfit?.profit || 0) - Number(todayReturns?.profit || 0);
  const rev         = Number(monthly?.revenue  || 0) - Number(monthlyReturns?.revenue || 0);
  const profit      = Number(monthlyProfit?.profit || 0) - Number(monthlyReturns?.profit || 0);

  res.json({
    today: {
      revenue: todayRev,
      profit:  todayPro,
      sales:   Number(today?.sales || 0),
      items:   Number(today?.items || 0),
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
      available:       Number(phoneStats?.available       || 0),
      soldThisMonth:   Number(phoneStats?.sold_month      || 0),
      profitThisMonth: Number(phoneStats?.phone_profit_month || 0),
      needsPricing:    Number(phoneStats?.needs_pricing   || 0),
    },
  });
}
