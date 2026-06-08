import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';
import { SALE_REVENUE } from '../../lib/finance';

// Read-only data-integrity check. Surfaces the corruption classes that previously
// required one-off "fix" endpoints (orphaned items, phone cost wiped to 0, sale
// totals that don't match their line items, negative stock, dangling phone sales).
// Owner-only. Never mutates anything.

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();

  const checks = [
    {
      key: 'orphan_sale_items',
      label: 'Sale items pointing to a missing sale',
      severity: 'error',
      sql: `SELECT si.id FROM sale_items si LEFT JOIN sales s ON s.id = si.sale_id WHERE s.id IS NULL LIMIT 20`,
    },
    {
      key: 'phone_zero_cost',
      label: 'Phone line items with cost price 0 (profit may be overstated)',
      severity: 'warn',
      sql: `SELECT id FROM sale_items WHERE product_id IS NULL AND cost_price = 0 AND unit_price > 0 LIMIT 20`,
    },
    {
      key: 'sale_total_mismatch',
      label: 'Sales whose total does not match their line items',
      severity: 'error',
      // Compare stored total_amount against the summed line-item revenue, allowing
      // for the sale-level discount. Tolerance of 1 absorbs rounding.
      sql: `SELECT s.id FROM sales s
            JOIN (SELECT sale_id, SUM(${SALE_REVENUE}) AS items_total FROM sale_items si GROUP BY sale_id) t
              ON t.sale_id = s.id
            WHERE ABS((s.total_amount - COALESCE(s.discount_amount, 0)) - t.items_total) > 1
            LIMIT 20`,
    },
    {
      key: 'negative_stock',
      label: 'Products with negative stock',
      severity: 'error',
      sql: `SELECT id FROM products WHERE stock < 0 LIMIT 20`,
    },
    {
      key: 'sold_phone_no_sale',
      label: 'Phones marked sold but with no linked sale',
      severity: 'warn',
      sql: `SELECT u.id FROM used_phones u
            LEFT JOIN sales s ON s.id = u.sold_in_sale
            WHERE u.status = 'sold' AND (u.sold_in_sale IS NULL OR s.id IS NULL) LIMIT 20`,
    },
    {
      key: 'done_repair_zero_price',
      label: 'Completed repairs with no customer price',
      severity: 'warn',
      sql: `SELECT id FROM repairs WHERE status IN ('Done','Delivered') AND customer_price = 0 LIMIT 20`,
    },
  ];

  const results = await db.batch(checks.map(c => ({ sql: c.sql })));

  const issues = checks.map((c, i) => {
    const rows = results[i] || [];
    return {
      key: c.key,
      label: c.label,
      severity: c.severity,
      count: rows.length,
      sampleIds: rows.map(r => Number(r.id)),
      // count reflects up to the LIMIT; a full count would need a second query.
      capped: rows.length === 20,
    };
  }).filter(x => x.count > 0);

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    issues,
  });
}
