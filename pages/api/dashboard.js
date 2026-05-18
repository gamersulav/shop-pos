import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const NPT_TODAY = "date('now', '+5 hours', '+45 minutes')";
const NPT_MONTH = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes')";
function nptDate(col)  { return `date(${col}, '+5 hours', '+45 minutes')`; }
function nptMonth(col) { return `strftime('%Y-%m', ${col}, '+5 hours', '+45 minutes')`; }

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();

  // Run all independent queries in parallel — one network batch instead of 17 sequential round-trips
  const [
    today, todayItems, todayProfit, todayCreditDiscs, todayReturns,
    monthly, monthlyProfit, monthlyCreditDiscs, monthlyReturns,
    payments, topProducts,
    todayExp, monthlyExp,
    repairStats, activeRepairs,
    phoneStats, phoneProfit,
    dTodayItems, dTodayPhones, dTodayRepairs, dTodayCrSales, dTodayCrRepairs,
    dMonthItems, dMonthPhones, dMonthRepairs, dMonthCrSales, dMonthCrRepairs,
    dailySales, dailyRepairs, dailyExp30,
  ] = await Promise.all([
    // ── Today ──────────────────────────────────────────────────────────────
    db.queryOne(`SELECT COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue, COUNT(*) as sales FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(si.quantity),0) as items FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptDate('s.created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptDate('s.created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY} AND credit_cleared=1`),
    db.queryOne(`SELECT COALESCE(SUM(return_amount),0) as revenue, COALESCE(SUM(return_profit),0) as profit FROM sales_returns WHERE ${nptDate('created_at')} = ${NPT_TODAY}`),
    // ── This month ─────────────────────────────────────────────────────────
    db.queryOne(`SELECT COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue, COUNT(*) as sales FROM sales WHERE ${nptMonth('created_at')} = ${NPT_MONTH}`),
    db.queryOne(`SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptMonth('s.created_at')} = ${NPT_MONTH}`),
    db.queryOne(`SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE ${nptMonth('created_at')} = ${NPT_MONTH} AND credit_cleared=1`),
    db.queryOne(`SELECT COALESCE(SUM(return_amount),0) as revenue, COALESCE(SUM(return_profit),0) as profit FROM sales_returns WHERE ${nptMonth('created_at')} = ${NPT_MONTH}`),
    // ── Payment breakdown & top products ───────────────────────────────────
    db.query(`SELECT payment_method as method, COUNT(*) as count, SUM(total_amount) as total FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY} GROUP BY payment_method ORDER BY total DESC`),
    db.query(`SELECT si.product_name as name, SUM(si.quantity) as qty, SUM(si.quantity*si.unit_price - COALESCE(si.item_discount,0)) as revenue, SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptMonth('s.created_at')} = ${NPT_MONTH} GROUP BY si.product_name ORDER BY qty DESC LIMIT 6`),
    // ── Expenses ───────────────────────────────────────────────────────────
    db.queryOne(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date = ${NPT_TODAY} AND category = 'expense'`),
    db.queryOne(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE ${nptMonth('expense_date')} = ${NPT_MONTH} AND category = 'expense'`),
    // ── Repairs & phones ───────────────────────────────────────────────────
    db.query(`SELECT status, COUNT(*) as count FROM repairs GROUP BY status`),
    db.query(`SELECT * FROM repairs WHERE status IN ('Pending','In Progress') ORDER BY created_at ASC LIMIT 15`),
    db.queryOne(`SELECT COUNT(CASE WHEN status='available' THEN 1 END) as available, COUNT(CASE WHEN status='sold' AND ${nptMonth('sold_at')} = ${NPT_MONTH} THEN 1 END) as sold_month, COUNT(CASE WHEN status='available' AND selling_price=0 THEN 1 END) as needs_pricing FROM used_phones`),
    db.queryOne(`SELECT COALESCE(SUM(si.unit_price - si.cost_price - COALESCE(si.item_discount,0)),0) as phone_profit_month FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE si.product_id IS NULL AND ${nptMonth('s.created_at')} = ${NPT_MONTH}`),
    // ── Discounts ──────────────────────────────────────────────────────────
    db.queryOne(`SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NOT NULL AND si.item_discount > 0 AND ${nptDate('s.created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NULL AND si.item_discount > 0 AND ${nptDate('s.created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(repair_discount),0) as total FROM repairs WHERE repair_discount > 0 AND status IN ('Done','Delivered') AND ${nptDate('created_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptDate('credit_cleared_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(credit_discount),0) as total FROM repairs WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptDate('credit_cleared_at')} = ${NPT_TODAY}`),
    db.queryOne(`SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NOT NULL AND si.item_discount > 0 AND ${nptMonth('s.created_at')} = ${NPT_MONTH}`),
    db.queryOne(`SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NULL AND si.item_discount > 0 AND ${nptMonth('s.created_at')} = ${NPT_MONTH}`),
    db.queryOne(`SELECT COALESCE(SUM(repair_discount),0) as total FROM repairs WHERE repair_discount > 0 AND status IN ('Done','Delivered') AND ${nptMonth('created_at')} = ${NPT_MONTH}`),
    db.queryOne(`SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptMonth('credit_cleared_at')} = ${NPT_MONTH}`),
    db.queryOne(`SELECT COALESCE(SUM(credit_discount),0) as total FROM repairs WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptMonth('credit_cleared_at')} = ${NPT_MONTH}`),
    // ── Daily profit (last 30 days) ─────────────────────────────────────────
    db.query(`SELECT ${nptDate('s.created_at')} as day, COALESCE(SUM(s.total_amount - COALESCE(s.credit_discount,0)),0) as revenue, COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptDate('s.created_at')} >= date('now','+5 hours','+45 minutes','-29 days') GROUP BY day ORDER BY day DESC`),
    db.query(`SELECT ${nptDate('created_at')} as day, COALESCE(SUM(customer_price - COALESCE(cost_price,0) - COALESCE(repair_discount,0)),0) as profit, COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as revenue FROM repairs WHERE status IN ('Done','Delivered') AND ${nptDate('created_at')} >= date('now','+5 hours','+45 minutes','-29 days') GROUP BY day ORDER BY day DESC`),
    db.query(`SELECT expense_date as day, COALESCE(SUM(amount),0) as expenses FROM expenses WHERE category='expense' AND expense_date >= date('now','+5 hours','+45 minutes','-29 days') GROUP BY day ORDER BY day DESC`),
  ]);

  function buildDisc(items, phones, repairs, crSales, crRepairs) {
    const d = { products: Number(items?.total||0), phones: Number(phones?.total||0), repairs: Number(repairs?.total||0), creditSales: Number(crSales?.total||0), creditRepairs: Number(crRepairs?.total||0) };
    d.total = d.products + d.phones + d.repairs + d.creditSales + d.creditRepairs;
    return d;
  }

  const todayDiscounts   = buildDisc(dTodayItems, dTodayPhones, dTodayRepairs, dTodayCrSales, dTodayCrRepairs);
  const monthlyDiscounts = buildDisc(dMonthItems, dMonthPhones, dMonthRepairs, dMonthCrSales, dMonthCrRepairs);

  const todayRev  = Number(today?.revenue     || 0) - Number(todayReturns?.revenue || 0);
  const todayPro  = Number(todayProfit?.profit || 0) - Number(todayReturns?.profit  || 0) - Number(todayCreditDiscs?.total || 0);
  const rev       = Number(monthly?.revenue   || 0) - Number(monthlyReturns?.revenue || 0);
  const profit    = Number(monthlyProfit?.profit || 0) - Number(monthlyReturns?.profit || 0) - Number(monthlyCreditDiscs?.total || 0);
  const todayExpTotal   = Number(todayExp?.total   || 0);
  const monthlyExpTotal = Number(monthlyExp?.total || 0);

  // Merge daily profit rows
  const dayMap = {};
  for (const r of dailySales)   { dayMap[r.day] = { ...dayMap[r.day], revenue: (dayMap[r.day]?.revenue||0)+Number(r.revenue), profit: (dayMap[r.day]?.profit||0)+Number(r.profit) }; }
  for (const r of dailyRepairs) { dayMap[r.day] = { ...dayMap[r.day], revenue: (dayMap[r.day]?.revenue||0)+Number(r.revenue), profit: (dayMap[r.day]?.profit||0)+Number(r.profit) }; }
  for (const r of dailyExp30)   { dayMap[r.day] = { ...dayMap[r.day], expenses: Number(r.expenses) }; }
  const dailyProfit = Object.entries(dayMap)
    .map(([day, v]) => ({ day, revenue: v.revenue||0, profit: (v.profit||0) - (v.expenses||0) }))
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30);

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.json({
    today:   { revenue: todayRev, grossProfit: todayPro, expenses: todayExpTotal, profit: todayPro - todayExpTotal, sales: Number(today?.sales || 0), items: Number(todayItems?.items || 0) },
    monthly: { revenue: rev, grossProfit: profit, expenses: monthlyExpTotal, profit: profit - monthlyExpTotal, sales: Number(monthly?.sales || 0), margin: rev > 0 ? ((profit - monthlyExpTotal) / rev) * 100 : 0 },
    payments,
    topProducts,
    repairStats,
    activeRepairs,
    phoneStats: { available: Number(phoneStats?.available || 0), soldThisMonth: Number(phoneStats?.sold_month || 0), profitThisMonth: Number(phoneProfit?.phone_profit_month || 0), needsPricing: Number(phoneStats?.needs_pricing || 0) },
    todayDiscounts,
    monthlyDiscounts,
    dailyProfit,
  });
}
