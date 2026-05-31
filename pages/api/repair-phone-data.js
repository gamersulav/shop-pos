import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

// One-time data repair: restores correct cost_price and unit_price for phone
// sale_items by reading the canonical values from used_phones, then recalculates
// sale totals. Safe to call multiple times (idempotent).
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (req.method !== 'POST') return res.status(405).end();

  const db = await getDb();

  // Step 1: Show what will change (preview before fixing)
  const affected = await db.query(`
    SELECT
      si.id        as sale_item_id,
      si.sale_id,
      si.product_name,
      si.unit_price   as si_unit_price,
      si.cost_price   as si_cost_price,
      up.selling_price as up_selling_price,
      up.cost_price    as up_cost_price
    FROM sale_items si
    JOIN used_phones up
      ON up.sold_in_sale = si.sale_id
     AND up.model = si.product_name
    WHERE si.product_id IS NULL
      AND (si.cost_price != up.cost_price OR si.unit_price != up.selling_price)
  `);

  // Step 2: Fix cost_price and unit_price in sale_items from used_phones
  await db.run(`
    UPDATE sale_items
    SET
      cost_price = (
        SELECT up.cost_price FROM used_phones up
        WHERE up.sold_in_sale = sale_items.sale_id
          AND up.model = sale_items.product_name
        LIMIT 1
      ),
      unit_price = (
        SELECT up.selling_price FROM used_phones up
        WHERE up.sold_in_sale = sale_items.sale_id
          AND up.model = sale_items.product_name
        LIMIT 1
      )
    WHERE product_id IS NULL
      AND EXISTS (
        SELECT 1 FROM used_phones up
        WHERE up.sold_in_sale = sale_items.sale_id
          AND up.model = sale_items.product_name
      )
  `);

  // Step 3: Recalculate total_amount and discount_amount for all sales
  // that contain phone items (to correct any totals corrupted by the bug)
  const phoneSales = await db.query(
    `SELECT DISTINCT sale_id FROM sale_items WHERE product_id IS NULL`
  );
  for (const { sale_id } of phoneSales) {
    const totals = await db.queryOne(
      `SELECT
         COALESCE(SUM(unit_price * quantity - COALESCE(item_discount,0)), 0) as t,
         COALESCE(SUM(COALESCE(item_discount,0)), 0) as d
       FROM sale_items WHERE sale_id=?`,
      [sale_id]
    );
    await db.run(
      'UPDATE sales SET total_amount=?, discount_amount=? WHERE id=?',
      [Number(totals?.t || 0), Number(totals?.d || 0), sale_id]
    );
  }

  res.json({
    ok: true,
    rowsFixed: affected.length,
    details: affected,
  });
}
