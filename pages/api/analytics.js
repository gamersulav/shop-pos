import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();
  const year = (req.query.year || new Date().getFullYear()).toString();

  // ── All years that have any data (NPT-adjusted) ───────────────────────────
  const yearRows = await db.query(`
    SELECT DISTINCT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr FROM sales
    UNION
    SELECT DISTINCT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr FROM repairs
    UNION
    SELECT DISTINCT strftime('%Y', expense_date) as yr FROM expenses
    ORDER BY yr DESC
  `);
  const years = [...new Set([...yearRows.map(r => r.yr).filter(Boolean), year])].sort((a, b) => b.localeCompare(a));

  // ── Monthly: product sales ────────────────────────────────────────────────
  const prodMonthly = await db.query(`
    SELECT CAST(strftime('%m', s.created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(si.quantity * si.unit_price - COALESCE(si.item_discount,0)), 0)                    as revenue,
           COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price) - COALESCE(si.item_discount,0)), 0)  as profit,
           COUNT(DISTINCT s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE strftime('%Y', s.created_at, '+5 hours', '+45 minutes') = ?
      AND si.product_id IS NOT NULL
    GROUP BY month
  `, [year]);

  // ── Monthly: phone sales ──────────────────────────────────────────────────
  const phoneMonthly = await db.query(`
    SELECT CAST(strftime('%m', s.created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(si.unit_price - COALESCE(si.item_discount,0)), 0)                 as revenue,
           COALESCE(SUM(si.unit_price - si.cost_price - COALESCE(si.item_discount,0)), 0) as profit,
           COUNT(s.id)                                     as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE strftime('%Y', s.created_at, '+5 hours', '+45 minutes') = ?
      AND si.product_id IS NULL
    GROUP BY month
  `, [year]);

  // ── Monthly returns split by type ─────────────────────────────────────────
  const prodReturnsMonthly = await db.query(`
    SELECT CAST(strftime('%m', created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(return_amount), 0) as revenue,
           COALESCE(SUM(return_profit), 0) as profit
    FROM sales_returns
    WHERE item_type = 'product'
      AND strftime('%Y', created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY month
  `, [year]);

  const phoneReturnsMonthly = await db.query(`
    SELECT CAST(strftime('%m', created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(return_amount), 0) as revenue,
           COALESCE(SUM(return_profit), 0) as profit
    FROM sales_returns
    WHERE item_type = 'phone'
      AND strftime('%Y', created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY month
  `, [year]);

  // ── Monthly: repairs ─────────────────────────────────────────────────────
  const repairMonthly = await db.query(`
    SELECT CAST(strftime('%m', created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - COALESCE(repair_discount,0) - COALESCE(credit_discount,0) ELSE 0 END), 0) as revenue,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - cost_price - COALESCE(repair_discount,0) - COALESCE(credit_discount,0) ELSE 0 END), 0) as profit,
           COUNT(*) as count
    FROM repairs
    WHERE strftime('%Y', created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY month
  `, [year]);

  // ── Yearly totals: products ───────────────────────────────────────────────
  const yearlyProd = await db.query(`
    SELECT strftime('%Y', s.created_at, '+5 hours', '+45 minutes')         as yr,
           COALESCE(SUM(si.quantity * si.unit_price - COALESCE(si.item_discount,0)), 0)                    as revenue,
           COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price) - COALESCE(si.item_discount,0)), 0)  as profit,
           COUNT(DISTINCT s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NOT NULL
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly totals: phones ─────────────────────────────────────────────────
  const yearlyPhone = await db.query(`
    SELECT strftime('%Y', s.created_at, '+5 hours', '+45 minutes')  as yr,
           COALESCE(SUM(si.unit_price - COALESCE(si.item_discount,0)), 0)          as revenue,
           COALESCE(SUM(si.unit_price - si.cost_price - COALESCE(si.item_discount,0)), 0) as profit,
           COUNT(s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NULL
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly returns split by type ──────────────────────────────────────────
  const yearlyProdReturns = await db.query(`
    SELECT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(return_amount), 0) as revenue,
           COALESCE(SUM(return_profit), 0) as profit
    FROM sales_returns WHERE item_type = 'product' GROUP BY yr
  `);

  const yearlyPhoneReturns = await db.query(`
    SELECT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(return_amount), 0) as revenue,
           COALESCE(SUM(return_profit), 0) as profit
    FROM sales_returns WHERE item_type = 'phone' GROUP BY yr
  `);

  // ── Yearly totals: repairs ────────────────────────────────────────────────
  const yearlyRepair = await db.query(`
    SELECT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - COALESCE(repair_discount,0) - COALESCE(credit_discount,0) ELSE 0 END), 0) as revenue,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - cost_price - COALESCE(repair_discount,0) - COALESCE(credit_discount,0) ELSE 0 END), 0) as profit,
           COUNT(*) as count
    FROM repairs
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Monthly credit discounts (product-only and phone-only sales) ─────────
  const prodCreditDiscs = await db.query(`
    SELECT CAST(strftime('%m', s.created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(s.credit_discount), 0) as disc
    FROM sales s
    WHERE strftime('%Y', s.created_at, '+5 hours', '+45 minutes') = ?
      AND s.credit_cleared = 1 AND s.credit_discount > 0
      AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.product_id IS NULL)
    GROUP BY month
  `, [year]);

  const phoneCreditDiscs = await db.query(`
    SELECT CAST(strftime('%m', s.created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(s.credit_discount), 0) as disc
    FROM sales s
    WHERE strftime('%Y', s.created_at, '+5 hours', '+45 minutes') = ?
      AND s.credit_cleared = 1 AND s.credit_discount > 0
      AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.product_id IS NOT NULL)
    GROUP BY month
  `, [year]);

  const yearlyProdCreditDiscs = await db.query(`
    SELECT strftime('%Y', s.created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(s.credit_discount), 0) as disc
    FROM sales s
    WHERE s.credit_cleared = 1 AND s.credit_discount > 0
      AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.product_id IS NULL)
    GROUP BY yr
  `);

  const yearlyPhoneCreditDiscs = await db.query(`
    SELECT strftime('%Y', s.created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(s.credit_discount), 0) as disc
    FROM sales s
    WHERE s.credit_cleared = 1 AND s.credit_discount > 0
      AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.product_id IS NOT NULL)
    GROUP BY yr
  `);

  // ── Monthly expenses ──────────────────────────────────────────────────────
  const expenseMonthly = await db.query(`
    SELECT CAST(strftime('%m', expense_date) AS INTEGER) as month,
           COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE strftime('%Y', expense_date) = ? AND category = 'expense'
    GROUP BY month
  `, [year]);

  // ── Yearly expenses ───────────────────────────────────────────────────────
  const expenseYearly = await db.query(`
    SELECT strftime('%Y', expense_date) as yr,
           COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE category = 'expense'
    GROUP BY yr ORDER BY yr DESC
  `);

  function makeMap(rows) {
    const m = {};
    for (const r of rows) m[r.month ? Number(r.month) : r.yr] = r;
    return m;
  }

  function toMonthArray(rows, countKey, returnsMap = {}, creditDiscMap = {}) {
    const map = makeMap(rows);
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ret = returnsMap[m] || { revenue: 0, profit: 0 };
      const disc = Number(creditDiscMap[m] || 0);
      return {
        month:   m,
        revenue: Math.max(0, Number(map[m]?.revenue || 0) - Number(ret.revenue) - disc),
        profit:  Math.max(0, Number(map[m]?.profit  || 0) - Number(ret.profit) - disc),
        count:   Number(map[m]?.[countKey] || 0),
      };
    });
  }

  const prodRetMap    = makeMap(prodReturnsMonthly);
  const phoneRetMap   = makeMap(phoneReturnsMonthly);
  const yrProdRetMap  = makeMap(yearlyProdReturns);
  const yrPhoneRetMap = makeMap(yearlyPhoneReturns);

  const prodCreditDiscMap  = {};
  prodCreditDiscs.forEach(r => { prodCreditDiscMap[Number(r.month)] = Number(r.disc); });
  const phoneCreditDiscMap = {};
  phoneCreditDiscs.forEach(r => { phoneCreditDiscMap[Number(r.month)] = Number(r.disc); });
  const yrProdCreditDiscMap  = {};
  yearlyProdCreditDiscs.forEach(r => { yrProdCreditDiscMap[r.yr] = Number(r.disc); });
  const yrPhoneCreditDiscMap = {};
  yearlyPhoneCreditDiscs.forEach(r => { yrPhoneCreditDiscMap[r.yr] = Number(r.disc); });

  // Build expense lookup maps
  const expMonthMap = {};
  expenseMonthly.forEach(r => { expMonthMap[Number(r.month)] = Number(r.total); });
  const expYearMap = {};
  expenseYearly.forEach(r => { expYearMap[r.yr] = Number(r.total); });

  res.json({
    year,
    years,
    products:       toMonthArray(prodMonthly,  'sales', prodRetMap,  prodCreditDiscMap),
    phones:         toMonthArray(phoneMonthly, 'sales', phoneRetMap, phoneCreditDiscMap),
    repairs:        toMonthArray(repairMonthly, 'count'),
    expensesByMonth: expMonthMap,
    yearly: {
      products: yearlyProd.map(r => {
        const ret  = yrProdRetMap[r.yr]  || { revenue: 0, profit: 0 };
        const disc = yrProdCreditDiscMap[r.yr] || 0;
        return { year: r.yr, revenue: Math.max(0, Number(r.revenue) - Number(ret.revenue) - disc), profit: Math.max(0, Number(r.profit) - Number(ret.profit) - disc), count: Number(r.sales) };
      }),
      phones: yearlyPhone.map(r => {
        const ret  = yrPhoneRetMap[r.yr]  || { revenue: 0, profit: 0 };
        const disc = yrPhoneCreditDiscMap[r.yr] || 0;
        return { year: r.yr, revenue: Math.max(0, Number(r.revenue) - Number(ret.revenue) - disc), profit: Math.max(0, Number(r.profit) - Number(ret.profit) - disc), count: Number(r.sales) };
      }),
      repairs:  yearlyRepair.map(r => ({ year: r.yr, revenue: Number(r.revenue), profit: Number(r.profit), count: Number(r.count) })),
      expenses: expYearMap,
    },
  });
}
