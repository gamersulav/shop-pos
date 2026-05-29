import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const NPT_TODAY      = "date('now', '+5 hours', '+45 minutes')";
const NPT_MONTH      = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes')";
const NPT_LAST_MONTH = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes', '-1 month')";
function nptDate(col)  { return `date(${col}, '+5 hours', '+45 minutes')`; }
function nptMonth(col) { return `strftime('%Y-%m', ${col}, '+5 hours', '+45 minutes')`; }

// helper — extract first row (like queryOne) from a batch result slot
const one = rows => rows[0] ?? null;

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();

  // All 38 queries in a single Turso round-trip via batch()
  const raw = await db.batch([
    // 0  today sales
    { sql: `SELECT COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue, COUNT(*) as sales FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY}` },
    // 1  today items
    { sql: `SELECT COALESCE(SUM(si.quantity),0) as items FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptDate('s.created_at')} = ${NPT_TODAY}` },
    // 2  today profit
    { sql: `SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptDate('s.created_at')} = ${NPT_TODAY}` },
    // 3  today credit discounts
    { sql: `SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY} AND credit_cleared=1` },
    // 4  today returns
    { sql: `SELECT COALESCE(SUM(return_amount),0) as revenue, COALESCE(SUM(return_profit),0) as profit FROM sales_returns WHERE ${nptDate('created_at')} = ${NPT_TODAY}` },
    // 5  monthly sales
    { sql: `SELECT COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue, COUNT(*) as sales FROM sales WHERE ${nptMonth('created_at')} = ${NPT_MONTH}` },
    // 6  monthly profit
    { sql: `SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptMonth('s.created_at')} = ${NPT_MONTH}` },
    // 7  monthly credit discounts
    { sql: `SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE ${nptMonth('created_at')} = ${NPT_MONTH} AND credit_cleared=1` },
    // 8  monthly returns
    { sql: `SELECT COALESCE(SUM(return_amount),0) as revenue, COALESCE(SUM(return_profit),0) as profit FROM sales_returns WHERE ${nptMonth('created_at')} = ${NPT_MONTH}` },
    // 9  payment breakdown (all rows)
    { sql: `SELECT payment_method as method, COUNT(*) as count, SUM(total_amount) as total FROM sales WHERE ${nptDate('created_at')} = ${NPT_TODAY} GROUP BY payment_method ORDER BY total DESC` },
    // 10 top products (all rows)
    { sql: `SELECT si.product_name as name, SUM(si.quantity) as qty, SUM(si.quantity*si.unit_price - COALESCE(si.item_discount,0)) as revenue, SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptMonth('s.created_at')} = ${NPT_MONTH} GROUP BY si.product_name ORDER BY qty DESC LIMIT 6` },
    // 11 today expenses
    { sql: `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date = ${NPT_TODAY} AND category = 'expense'` },
    // 12 monthly expenses
    { sql: `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE ${nptMonth('expense_date')} = ${NPT_MONTH} AND category = 'expense'` },
    // 13 repair stats (all rows)
    { sql: `SELECT status, COUNT(*) as count FROM repairs GROUP BY status` },
    // 14 active repairs (all rows)
    { sql: `SELECT * FROM repairs WHERE status IN ('Pending','In Progress') ORDER BY created_at ASC LIMIT 15` },
    // 15 phone stats
    { sql: `SELECT COUNT(CASE WHEN status='available' THEN 1 END) as available, COUNT(CASE WHEN status='sold' AND ${nptMonth('sold_at')} = ${NPT_MONTH} THEN 1 END) as sold_month, COUNT(CASE WHEN status='available' AND selling_price=0 THEN 1 END) as needs_pricing FROM used_phones` },
    // 16 phone profit this month
    { sql: `SELECT COALESCE(SUM(si.unit_price - si.cost_price - COALESCE(si.item_discount,0)),0) as phone_profit_month FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE si.product_id IS NULL AND ${nptMonth('s.created_at')} = ${NPT_MONTH}` },
    // 17-21 today discounts
    { sql: `SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NOT NULL AND si.item_discount > 0 AND ${nptDate('s.created_at')} = ${NPT_TODAY}` },
    { sql: `SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NULL AND si.item_discount > 0 AND ${nptDate('s.created_at')} = ${NPT_TODAY}` },
    { sql: `SELECT COALESCE(SUM(repair_discount),0) as total FROM repairs WHERE repair_discount > 0 AND status IN ('Done','Delivered') AND ${nptDate('created_at')} = ${NPT_TODAY}` },
    { sql: `SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptDate('credit_cleared_at')} = ${NPT_TODAY}` },
    { sql: `SELECT COALESCE(SUM(credit_discount),0) as total FROM repairs WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptDate('credit_cleared_at')} = ${NPT_TODAY}` },
    // 22-26 monthly discounts
    { sql: `SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NOT NULL AND si.item_discount > 0 AND ${nptMonth('s.created_at')} = ${NPT_MONTH}` },
    { sql: `SELECT COALESCE(SUM(si.item_discount),0) as total FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE si.product_id IS NULL AND si.item_discount > 0 AND ${nptMonth('s.created_at')} = ${NPT_MONTH}` },
    { sql: `SELECT COALESCE(SUM(repair_discount),0) as total FROM repairs WHERE repair_discount > 0 AND status IN ('Done','Delivered') AND ${nptMonth('created_at')} = ${NPT_MONTH}` },
    { sql: `SELECT COALESCE(SUM(credit_discount),0) as total FROM sales WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptMonth('credit_cleared_at')} = ${NPT_MONTH}` },
    { sql: `SELECT COALESCE(SUM(credit_discount),0) as total FROM repairs WHERE payment_method='Credit' AND credit_cleared=1 AND credit_discount > 0 AND ${nptMonth('credit_cleared_at')} = ${NPT_MONTH}` },
    // 27 daily sales (all rows)
    { sql: `SELECT ${nptDate('s.created_at')} as day, COALESCE(SUM(s.total_amount - COALESCE(s.credit_discount,0)),0) as revenue, COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptDate('s.created_at')} >= date('now','+5 hours','+45 minutes','-29 days') GROUP BY day ORDER BY day DESC` },
    // 28 daily repairs (all rows)
    { sql: `SELECT ${nptDate('created_at')} as day, COALESCE(SUM(customer_price - COALESCE(cost_price,0) - COALESCE(repair_discount,0)),0) as profit, COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as revenue FROM repairs WHERE status IN ('Done','Delivered') AND ${nptDate('created_at')} >= date('now','+5 hours','+45 minutes','-29 days') GROUP BY day ORDER BY day DESC` },
    // 29 daily expenses (all rows)
    { sql: `SELECT expense_date as day, COALESCE(SUM(amount),0) as expenses FROM expenses WHERE category='expense' AND expense_date >= date('now','+5 hours','+45 minutes','-29 days') GROUP BY day ORDER BY day DESC` },
    // 30 inventory products
    { sql: `SELECT COALESCE(SUM(cost_price * stock),0) as total FROM products WHERE active=1` },
    // 31 inventory phones
    { sql: `SELECT COALESCE(SUM(cost_price),0) as total FROM used_phones WHERE status='available'` },
    // 32 supplier debt
    { sql: `SELECT COALESCE(SUM(CASE WHEN direction!='out' THEN unit_cost*quantity ELSE 0 END),0) as we_owe, COALESCE(SUM(CASE WHEN direction='out' THEN unit_cost*quantity ELSE 0 END),0) as they_owe FROM shop_tabs WHERE settled=0` },
    // 33-37 last month
    { sql: `SELECT COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue, COUNT(*) as sales FROM sales WHERE ${nptMonth('created_at')} = ${NPT_LAST_MONTH}` },
    { sql: `SELECT COALESCE(SUM(si.quantity*(si.unit_price-si.cost_price) - COALESCE(si.item_discount,0)),0) as profit FROM sales s JOIN sale_items si ON si.sale_id=s.id WHERE ${nptMonth('s.created_at')} = ${NPT_LAST_MONTH}` },
    { sql: `SELECT COALESCE(SUM(return_amount),0) as revenue, COALESCE(SUM(return_profit),0) as profit FROM sales_returns WHERE ${nptMonth('created_at')} = ${NPT_LAST_MONTH}` },
    { sql: `SELECT COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as revenue, COALESCE(SUM(customer_price - COALESCE(cost_price,0) - COALESCE(repair_discount,0)),0) as profit FROM repairs WHERE status IN ('Done','Delivered') AND ${nptMonth('created_at')} = ${NPT_LAST_MONTH}` },
    { sql: `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE category='expense' AND ${nptMonth('expense_date')} = ${NPT_LAST_MONTH}` },
  ]);

  const today          = one(raw[0]);
  const todayItems     = one(raw[1]);
  const todayProfit    = one(raw[2]);
  const todayCreditDiscs = one(raw[3]);
  const todayReturns   = one(raw[4]);
  const monthly        = one(raw[5]);
  const monthlyProfit  = one(raw[6]);
  const monthlyCreditDiscs = one(raw[7]);
  const monthlyReturns = one(raw[8]);
  const payments       = raw[9];
  const topProducts    = raw[10];
  const todayExp       = one(raw[11]);
  const monthlyExp     = one(raw[12]);
  const repairStats    = raw[13];
  const activeRepairs  = raw[14];
  const phoneStats     = one(raw[15]);
  const phoneProfit    = one(raw[16]);
  const dTodayItems    = one(raw[17]);
  const dTodayPhones   = one(raw[18]);
  const dTodayRepairs  = one(raw[19]);
  const dTodayCrSales  = one(raw[20]);
  const dTodayCrRepairs = one(raw[21]);
  const dMonthItems    = one(raw[22]);
  const dMonthPhones   = one(raw[23]);
  const dMonthRepairs  = one(raw[24]);
  const dMonthCrSales  = one(raw[25]);
  const dMonthCrRepairs = one(raw[26]);
  const dailySales     = raw[27];
  const dailyRepairs   = raw[28];
  const dailyExp30     = raw[29];
  const invProducts    = one(raw[30]);
  const invPhones      = one(raw[31]);
  const supplierDebt   = one(raw[32]);
  const lmSales        = one(raw[33]);
  const lmSalesProfit  = one(raw[34]);
  const lmReturns      = one(raw[35]);
  const lmRepairs      = one(raw[36]);
  const lmExp          = one(raw[37]);

  function buildDisc(items, phones, repairs, crSales, crRepairs) {
    const d = {
      products:     Number(items?.total    || 0),
      phones:       Number(phones?.total   || 0),
      repairs:      Number(repairs?.total  || 0),
      creditSales:  Number(crSales?.total  || 0),
      creditRepairs: Number(crRepairs?.total || 0),
    };
    d.total = d.products + d.phones + d.repairs + d.creditSales + d.creditRepairs;
    return d;
  }

  const todayDiscounts   = buildDisc(dTodayItems, dTodayPhones, dTodayRepairs, dTodayCrSales, dTodayCrRepairs);
  const monthlyDiscounts = buildDisc(dMonthItems, dMonthPhones, dMonthRepairs, dMonthCrSales, dMonthCrRepairs);

  const todayRev  = Number(today?.revenue     || 0) - Number(todayReturns?.revenue || 0);
  const todayPro  = Number(todayProfit?.profit || 0) - Number(todayReturns?.profit  || 0) - Number(todayCreditDiscs?.total || 0);
  const rev       = Number(monthly?.revenue   || 0) - Number(monthlyReturns?.revenue || 0);
  const profit    = Number(monthlyProfit?.profit || 0) - Number(monthlyReturns?.profit || 0) - Number(monthlyCreditDiscs?.total || 0);
  const lmRev    = Number(lmSales?.revenue || 0) + Number(lmRepairs?.revenue || 0) - Number(lmReturns?.revenue || 0);
  const lmGross  = Number(lmSalesProfit?.profit || 0) + Number(lmRepairs?.profit || 0) - Number(lmReturns?.profit || 0);
  const lmExpAmt = Number(lmExp?.total || 0);
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

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    today:     { revenue: todayRev, grossProfit: todayPro, expenses: todayExpTotal, profit: todayPro - todayExpTotal, sales: Number(today?.sales || 0), items: Number(todayItems?.items || 0) },
    monthly:   { revenue: rev, grossProfit: profit, expenses: monthlyExpTotal, profit: profit - monthlyExpTotal, sales: Number(monthly?.sales || 0), margin: rev > 0 ? ((profit - monthlyExpTotal) / rev) * 100 : 0 },
    lastMonth: { revenue: lmRev, grossProfit: lmGross, expenses: lmExpAmt, profit: lmGross - lmExpAmt, sales: Number(lmSales?.sales || 0) },
    payments,
    topProducts,
    repairStats,
    activeRepairs,
    phoneStats: { available: Number(phoneStats?.available || 0), soldThisMonth: Number(phoneStats?.sold_month || 0), profitThisMonth: Number(phoneProfit?.phone_profit_month || 0), needsPricing: Number(phoneStats?.needs_pricing || 0) },
    todayDiscounts,
    monthlyDiscounts,
    dailyProfit,
    inventoryValue: {
      products: Number(invProducts?.total || 0),
      phones:   Number(invPhones?.total   || 0),
      total:    Number(invProducts?.total || 0) + Number(invPhones?.total || 0),
    },
    supplierDebt: {
      weOwe:   Number(supplierDebt?.we_owe   || 0),
      theyOwe: Number(supplierDebt?.they_owe || 0),
      net:     Number(supplierDebt?.they_owe || 0) - Number(supplierDebt?.we_owe || 0),
    },
  });
}
