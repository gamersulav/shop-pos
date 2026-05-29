import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

function calcPoints(tier, amount) {
  const rate = tier === 'Platinum' ? 2 : tier === 'Gold' ? 1.5 : 1;
  return Math.floor(amount / 100 * rate);
}

// Never downgrade — take the highest of calculated vs current tier
function newTier(phoneCount, nonPhoneSpent, currentTier = 'Silver') {
  const TIERS = ['Silver', 'Gold', 'Platinum'];
  const byPhone = phoneCount >= 6 ? 'Platinum' : phoneCount >= 3 ? 'Gold' : 'Silver';
  const bySpend = nonPhoneSpent >= 20000 ? 'Platinum' : nonPhoneSpent >= 8000 ? 'Gold' : 'Silver';
  const calculated = TIERS[Math.max(TIERS.indexOf(byPhone), TIERS.indexOf(bySpend))];
  return TIERS[Math.max(TIERS.indexOf(currentTier), TIERS.indexOf(calculated))];
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'POST') {
    // repair_id + repair_amount: for repair-based awards (no sale_items row)
    const { customer_id, sale_id, repair_id, amount, loyalty_discount = 0, repair_amount = 0 } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

    const prevTier = (await db.queryOne('SELECT tier FROM customers WHERE id=?', [Number(customer_id)]))?.tier;

    await db.tx(async tx => {
      const c = await tx.queryOne('SELECT * FROM customers WHERE id=?', [Number(customer_id)]);
      if (!c) return;

      // For sales: derive phone count and non-phone spend from sale_items
      // For repairs: repair_amount is passed directly as non-phone spend
      let phonesInSale = 0;
      let nonPhoneGross = Number(repair_amount) || 0; // repairs count as non-phone spend

      if (sale_id) {
        const saleItems = await tx.query('SELECT * FROM sale_items WHERE sale_id=?', [Number(sale_id)]);
        phonesInSale = saleItems.filter(si => si.product_id == null).length;
        nonPhoneGross = saleItems
          .filter(si => si.product_id != null)
          .reduce((s, si) => s + Math.max(0, Number(si.unit_price) * (Number(si.quantity) || 1) - (Number(si.item_discount) || 0)), 0);
      }

      const earnAmt       = Math.max(0, Number(amount) - Number(loyalty_discount));
      const earned        = calcPoints(c.tier, earnAmt);
      const newSpent      = Number(c.total_spent) + Number(amount);
      const newVisits     = Number(c.visit_count) + 1;
      const newPhoneCount = Number(c.phone_purchase_count || 0) + phonesInSale;
      const newNonPhone   = Number(c.non_phone_spent || 0) + Math.max(0, nonPhoneGross);

      // 100 pts = Rs 10 → pts_deducted = loyalty_discount × 10
      const redeemed  = Number(loyalty_discount) * 10;
      const newPoints = Math.max(0, Number(c.points) + earned - redeemed);
      const tier      = newTier(newPhoneCount, newNonPhone, c.tier);

      await tx.run(
        `UPDATE customers SET total_spent=?, visit_count=?, points=?, tier=?, phone_purchase_count=?, non_phone_spent=?, last_visit=datetime('now') WHERE id=?`,
        [newSpent, newVisits, newPoints, tier, newPhoneCount, newNonPhone, Number(customer_id)]
      );

      const refId = sale_id ? Number(sale_id) : (repair_id ? Number(repair_id) : null);
      const refNote = sale_id ? `sale #${sale_id}` : `repair #${repair_id}`;

      if (earned > 0) {
        await tx.run(
          `INSERT INTO loyalty_events (customer_id, sale_id, type, points, note) VALUES (?, ?, 'earned', ?, ?)`,
          [Number(customer_id), refId, earned, `Earned on ${refNote}`]
        );
      }

      if (redeemed > 0) {
        await tx.run(
          `INSERT INTO loyalty_events (customer_id, sale_id, type, points, note) VALUES (?, ?, 'redeemed', ?, ?)`,
          [Number(customer_id), refId, -redeemed, `Redeemed Rs ${loyalty_discount} off`]
        );
      }

      if (sale_id) {
        await tx.run(
          'UPDATE sales SET loyalty_customer_id=?, loyalty_discount=? WHERE id=?',
          [Number(customer_id), Number(loyalty_discount), Number(sale_id)]
        );
      }
    });

    const updated = await db.queryOne('SELECT * FROM customers WHERE id=?', [Number(customer_id)]);
    return res.json({ ok: true, customer: updated, prevTier });
  }

  res.status(405).end();
}
