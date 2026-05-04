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
    ORDER BY yr DESC
  `);
  const years = [...new Set([...yearRows.map(r => r.yr).filter(Boolean), year])].sort((a, b) => b.localeCompare(a));

  // ── Monthly: product sales ────────────────────────────────────────────────
  const prodMonthly = await db.query(`
    SELECT CAST(strftime('%m', s.created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(si.quantity * si.unit_price), 0)                    as revenue,
           COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price)), 0)  as profit,
           COUNT(DISTINCT s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE strftime('%Y', s.created_at, '+5 hours', '+45 minutes') = ?
      AND si.product_id IS NOT NULL
    GROUP BY month
  `, [year]);

  // ── Monthly: phone sales ──────────────────────────────────────────────────
  const phoneMonthly = await db.query(`
    SELECT CAST(strftime('%m', s.created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(si.unit_price), 0)                 as revenue,
           COALESCE(SUM(si.unit_price - si.cost_price), 0) as profit,
           COUNT(s.id)                                     as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE strftime('%Y', s.created_at, '+5 hours', '+45 minutes') = ?
      AND si.product_id IS NULL
    GROUP BY month
  `, [year]);

  // ── Monthly: sales returns (deductions) ──────────────────────────────────
  const returnsMonthly = await db.query(`
    SELECT CAST(strftime('%m', created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(return_amount), 0) as revenue,
           COALESCE(SUM(return_profit), 0) as profit
    FROM sales_returns
    WHERE strftime('%Y', created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY month
  `, [year]);

  // ── Monthly: repairs ─────────────────────────────────────────────────────
  const repairMonthly = await db.query(`
    SELECT CAST(strftime('%m', created_at, '+5 hours', '+45 minutes') AS INTEGER) as month,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price ELSE 0 END), 0)              as revenue,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - cost_price ELSE 0 END), 0) as profit,
           COUNT(*) as count
    FROM repairs
    WHERE strftime('%Y', created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY month
  `, [year]);

  // ── Yearly totals: products ───────────────────────────────────────────────
  const yearlyProd = await db.query(`
    SELECT strftime('%Y', s.created_at, '+5 hours', '+45 minutes')         as yr,
           COALESCE(SUM(si.quantity * si.unit_price), 0)                    as revenue,
           COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price)), 0)  as profit,
           COUNT(DISTINCT s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NOT NULL
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly totals: phones ─────────────────────────────────────────────────
  const yearlyPhone = await db.query(`
    SELECT strftime('%Y', s.created_at, '+5 hours', '+45 minutes')  as yr,
           COALESCE(SUM(si.unit_price), 0)                          as revenue,
           COALESCE(SUM(si.unit_price - si.cost_price), 0)          as profit,
           COUNT(s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NULL
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly totals: returns ────────────────────────────────────────────────
  const yearlyReturns = await db.query(`
    SELECT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(return_amount), 0) as revenue,
           COALESCE(SUM(return_profit), 0) as profit
    FROM sales_returns GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly totals: repairs ────────────────────────────────────────────────
  const yearlyRepair = await db.query(`
    SELECT strftime('%Y', created_at, '+5 hours', '+45 minutes') as yr,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price ELSE 0 END), 0)              as revenue,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - cost_price ELSE 0 END), 0) as profit,
           COUNT(*) as count
    FROM repairs
    GROUP BY yr ORDER BY yr DESC
  `);

  const returnsMap = {};
  for (const r of returnsMonthly) returnsMap[Number(r.month)] = r;

  function toMonthArray(rows, countKey = 'sales', deductReturns = false) {
    const map = {};
    for (const r of rows) map[Number(r.month)] = r;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ret = deductReturns ? (returnsMap[m] || { revenue: 0, profit: 0 }) : { revenue: 0, profit: 0 };
      return {
        month:   m,
        revenue: Math.max(0, Number(map[m]?.revenue || 0) - Number(ret.revenue)),
        profit:  Math.max(0, Number(map[m]?.profit  || 0) - Number(ret.profit)),
        count:   Number(map[m]?.[countKey] || 0),
      };
    });
  }

  const yearlyReturnsMap = {};
  for (const r of yearlyReturns) yearlyReturnsMap[r.yr] = r;

  res.json({
    year,
    years,
    products: toMonthArray(prodMonthly, 'sales', true),
    phones:   toMonthArray(phoneMonthly),
    repairs:  toMonthArray(repairMonthly, 'count'),
    yearly: {
      products: yearlyProd.map(r  => {
        const ret = yearlyReturnsMap[r.yr] || { revenue: 0, profit: 0 };
        return { year: r.yr, revenue: Math.max(0, Number(r.revenue) - Number(ret.revenue)), profit: Math.max(0, Number(r.profit) - Number(ret.profit)), count: Number(r.sales) };
      }),
      phones:   yearlyPhone.map(r => ({ year: r.yr, revenue: Number(r.revenue), profit: Number(r.profit), count: Number(r.sales) })),
      repairs:  yearlyRepair.map(r => ({ year: r.yr, revenue: Number(r.revenue), profit: Number(r.profit), count: Number(r.count) })),
    },
  });
}
