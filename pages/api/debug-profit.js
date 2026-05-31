import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const NPT_MONTH = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes')";
function nptMonth(col) { return `strftime('%Y-%m', ${col}, '+5 hours', '+45 minutes')`; }

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();

  const [phoneSaleItems, usedPhonesSold, monthlySalesRaw, monthlyRepairsRaw] = await Promise.all([
    // All phone sale_items this month
    db.query(`
      SELECT si.id, si.sale_id, si.product_name, si.unit_price, si.cost_price,
             COALESCE(si.item_discount,0) as item_discount,
             (si.unit_price - si.cost_price - COALESCE(si.item_discount,0)) as profit,
             s.created_at
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id IS NULL
        AND ${nptMonth('s.created_at')} = ${NPT_MONTH}
      ORDER BY s.created_at DESC
    `),
    // used_phones that were sold and linked to sales this month
    db.query(`
      SELECT up.id, up.model, up.cost_price as up_cost_price, up.selling_price,
             up.sold_in_sale, up.status, s.created_at as sold_at
      FROM used_phones up
      LEFT JOIN sales s ON s.id = up.sold_in_sale
      WHERE up.status = 'sold'
        AND ${nptMonth('s.created_at')} = ${NPT_MONTH}
      ORDER BY s.created_at DESC
    `),
    // Monthly sales profit breakdown
    db.query(`
      SELECT
        COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as revenue,
        COUNT(*) as sales_count
      FROM sales WHERE ${nptMonth('created_at')} = ${NPT_MONTH}
    `),
    // Monthly repair profit
    db.query(`
      SELECT id, customer_name, customer_price, cost_price,
             COALESCE(repair_discount,0) as repair_discount,
             status,
             (customer_price - COALESCE(cost_price,0) - COALESCE(repair_discount,0)) as profit
      FROM repairs
      WHERE ${nptMonth('created_at')} = ${NPT_MONTH}
        AND status IN ('Done','Delivered')
    `),
  ]);

  // Check mismatches between sale_items and used_phones
  const mismatches = phoneSaleItems.map(si => {
    const up = usedPhonesSold.find(u => u.sold_in_sale === si.sale_id && u.model === si.product_name);
    return {
      sale_item_id: si.id,
      sale_id: si.sale_id,
      model: si.product_name,
      si_unit_price: si.unit_price,
      si_cost_price: si.cost_price,
      si_profit: si.profit,
      up_selling_price: up?.selling_price ?? 'NOT FOUND',
      up_cost_price: up?.up_cost_price ?? 'NOT FOUND',
      cost_mismatch: up ? si.cost_price !== up.up_cost_price : 'no used_phone record',
      price_mismatch: up ? si.unit_price !== up.selling_price : 'no used_phone record',
    };
  });

  const totalPhoneProfit = phoneSaleItems.reduce((s, r) => s + Number(r.profit), 0);
  const totalRepairProfit = monthlyRepairsRaw.reduce((s, r) => s + Number(r.profit), 0);

  res.json({
    summary: {
      phoneItemsThisMonth: phoneSaleItems.length,
      totalPhoneProfit,
      repairsThisMonth: monthlyRepairsRaw.length,
      totalRepairProfit,
      monthlySales: monthlySalesRaw[0],
    },
    phoneSaleItems,
    usedPhonesSold,
    mismatches,
    repairs: monthlyRepairsRaw,
  });
}
