import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

function calcPoints(tier, amount) {
  const rate = tier === 'Platinum' ? 2 : tier === 'Gold' ? 1.5 : 1;
  return Math.floor(amount / 100 * rate);
}

function newTier(phoneCount, nonPhoneSpent) {
  const TIERS = ['Silver', 'Gold', 'Platinum'];
  const byPhone = phoneCount >= 6 ? 'Platinum' : phoneCount >= 3 ? 'Gold' : 'Silver';
  const bySpend = nonPhoneSpent >= 20000 ? 'Platinum' : nonPhoneSpent >= 8000 ? 'Gold' : 'Silver';
  return TIERS[Math.max(TIERS.indexOf(byPhone), TIERS.indexOf(bySpend))];
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'POST') {
    const { customer_id, sale_id, amount, loyalty_discount = 0 } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

    await db.tx(async tx => {
      const c = await tx.queryOne('SELECT * FROM customers WHERE id=?', [Number(customer_id)]);
      if (!c) return;

      // Separate phone items (product_id IS NULL) from accessory/repair items
      const saleItems = sale_id
        ? await tx.query('SELECT * FROM sale_items WHERE sale_id=?', [Number(sale_id)])
        : [];
      const phonesInSale = saleItems.filter(si => si.product_id == null).length;
      const nonPhoneGross = saleItems
        .filter(si => si.product_id != null)
        .reduce((s, si) => s + Math.max(0, Number(si.unit_price) * (Number(si.quantity) || 1) - (Number(si.item_discount) || 0)), 0);

      const earnAmt       = Math.max(0, Number(amount) - Number(loyalty_discount));
      const earned        = calcPoints(c.tier, earnAmt);
      const newSpent      = Number(c.total_spent) + Number(amount);
      const newVisits     = Number(c.visit_count) + 1;
      const newPhoneCount = Number(c.phone_purchase_count || 0) + phonesInSale;
      const newNonPhone   = Number(c.non_phone_spent || 0) + Math.max(0, nonPhoneGross);
      const newPoints     = Math.max(0, Number(c.points) + earned - Math.floor(Number(loyalty_discount) / 10));
      const tier          = newTier(newPhoneCount, newNonPhone);

      await tx.run(
        `UPDATE customers SET total_spent=?, visit_count=?, points=?, tier=?, phone_purchase_count=?, non_phone_spent=?, last_visit=datetime('now') WHERE id=?`,
        [newSpent, newVisits, newPoints, tier, newPhoneCount, newNonPhone, Number(customer_id)]
      );

      if (earned > 0) {
        await tx.run(
          `INSERT INTO loyalty_events (customer_id, sale_id, type, points, note) VALUES (?, ?, 'earned', ?, ?)`,
          [Number(customer_id), sale_id ? Number(sale_id) : null, earned, `Earned on sale #${sale_id}`]
        );
      }

      if (loyalty_discount > 0) {
        const redeemed = Math.floor(Number(loyalty_discount) / 10);
        await tx.run(
          `INSERT INTO loyalty_events (customer_id, sale_id, type, points, note) VALUES (?, ?, 'redeemed', ?, ?)`,
          [Number(customer_id), sale_id ? Number(sale_id) : null, -redeemed, `Redeemed Rs ${loyalty_discount} off`]
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
    return res.json({ ok: true, customer: updated });
  }

  res.status(405).end();
}
