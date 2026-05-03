import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();
  const year = (req.query.year || new Date().getFullYear()).toString();

  // ── All years that have any data ───────────────────────────────────────────
  const yearRows = await db.query(`
    SELECT DISTINCT strftime('%Y', created_at) as yr FROM sales
    UNION
    SELECT DISTINCT strftime('%Y', created_at) as yr FROM repairs
    ORDER BY yr DESC
  `);
  const years = [...new Set([...yearRows.map(r => r.yr).filter(Boolean), year])].sort((a, b) => b.localeCompare(a));

  // ── Monthly: product sales (sale_items with product_id) ───────────────────
  const prodMonthly = await db.query(`
    SELECT CAST(strftime('%m', s.created_at) AS INTEGER) as month,
           COALESCE(SUM(si.quantity * si.unit_price), 0)                    as revenue,
           COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price)), 0)  as profit,
           COUNT(DISTINCT s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE strftime('%Y', s.created_at) = ?
      AND si.product_id IS NOT NULL
    GROUP BY month
  `, [year]);

  // ── Monthly: phone sales (sale_items where product_id IS NULL) ────────────
  const phoneMonthly = await db.query(`
    SELECT CAST(strftime('%m', s.created_at) AS INTEGER) as month,
           COALESCE(SUM(si.unit_price), 0)               as revenue,
           COALESCE(SUM(si.unit_price - si.cost_price), 0) as profit,
           COUNT(s.id)                                    as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE strftime('%Y', s.created_at) = ?
      AND si.product_id IS NULL
    GROUP BY month
  `, [year]);

  // ── Monthly: repairs (revenue only for Done/Delivered, count all) ─────────
  const repairMonthly = await db.query(`
    SELECT CAST(strftime('%m', created_at) AS INTEGER) as month,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price ELSE 0 END), 0)              as revenue,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - cost_price ELSE 0 END), 0) as profit,
           COUNT(*) as count
    FROM repairs
    WHERE strftime('%Y', created_at) = ?
    GROUP BY month
  `, [year]);

  // ── Yearly totals: products ───────────────────────────────────────────────
  const yearlyProd = await db.query(`
    SELECT strftime('%Y', s.created_at)                                     as yr,
           COALESCE(SUM(si.quantity * si.unit_price), 0)                    as revenue,
           COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price)), 0)  as profit,
           COUNT(DISTINCT s.id)                                              as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NOT NULL
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly totals: phones ─────────────────────────────────────────────────
  const yearlyPhone = await db.query(`
    SELECT strftime('%Y', s.created_at)                  as yr,
           COALESCE(SUM(si.unit_price), 0)               as revenue,
           COALESCE(SUM(si.unit_price - si.cost_price), 0) as profit,
           COUNT(s.id)                                   as sales
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NULL
    GROUP BY yr ORDER BY yr DESC
  `);

  // ── Yearly totals: repairs ────────────────────────────────────────────────
  const yearlyRepair = await db.query(`
    SELECT strftime('%Y', created_at) as yr,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price ELSE 0 END), 0)              as revenue,
           COALESCE(SUM(CASE WHEN status IN ('Done','Delivered') THEN customer_price - cost_price ELSE 0 END), 0) as profit,
           COUNT(*) as count
    FROM repairs
    GROUP BY yr ORDER BY yr DESC
  `);

  function toMonthArray(rows, countKey = 'sales') {
    const map = {};
    for (const r of rows) map[Number(r.month)] = r;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        month:   m,
        revenue: Number(map[m]?.revenue || 0),
        profit:  Number(map[m]?.profit  || 0),
        count:   Number(map[m]?.[countKey] || 0),
      };
    });
  }

  res.json({
    year,
    years,
    products: toMonthArray(prodMonthly),
    phones:   toMonthArray(phoneMonthly),
    repairs:  toMonthArray(repairMonthly, 'count'),
    yearly: {
      products: yearlyProd.map(r  => ({ year: r.yr, revenue: Number(r.revenue), profit: Number(r.profit), count: Number(r.sales) })),
      phones:   yearlyPhone.map(r => ({ year: r.yr, revenue: Number(r.revenue), profit: Number(r.profit), count: Number(r.sales) })),
      repairs:  yearlyRepair.map(r => ({ year: r.yr, revenue: Number(r.revenue), profit: Number(r.profit), count: Number(r.count) })),
    },
  });
}
