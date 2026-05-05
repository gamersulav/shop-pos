import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const METHODS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'];

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const db = await getDb();

  if (req.method === 'POST') {
    const { date, payment_method, amount } = req.body;
    if (!date || !payment_method) return res.status(400).json({ error: 'date and payment_method required' });
    await db.run(
      `INSERT OR REPLACE INTO cash_opening (date, payment_method, amount) VALUES (?,?,?)`,
      [date, payment_method, Math.abs(Number(amount)) || 0]
    );
    return res.json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();

  const { d: todayNPT } = await db.queryOne(`SELECT date('now','+5 hours','+45 minutes') as d`);
  const targetDate = req.query.date || todayNPT;

  // Opening balances for target date
  const openingRows = await db.query(
    `SELECT payment_method, amount FROM cash_opening WHERE date=?`, [targetDate]
  );
  const opening = {};
  METHODS.forEach(m => { opening[m] = 0; });
  openingRows.forEach(r => { opening[r.payment_method] = Number(r.amount); });

  // Product sales by payment method (excludes phone sales where product_id IS NULL, excludes Credit)
  const productSales = await db.query(`
    SELECT s.payment_method, COALESCE(SUM(si.quantity * si.unit_price), 0) as total
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE si.product_id IS NOT NULL
      AND s.payment_method != 'Credit'
      AND date(s.created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY s.payment_method
  `, [targetDate]);

  // Repair collections by payment method (Done/Delivered only, excludes Credit)
  const repairSales = await db.query(`
    SELECT payment_method, COALESCE(SUM(customer_price), 0) as total
    FROM repairs
    WHERE status IN ('Done','Delivered')
      AND payment_method != 'Credit'
      AND date(created_at, '+5 hours', '+45 minutes') = ?
    GROUP BY payment_method
  `, [targetDate]);

  // Expenses: cash outflow
  const expensesRow = await db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_date = ?`, [targetDate]
  );

  // Supplier payments: shop tab debts settled today (direction='in' = we owe them → we paid cash)
  const supplierRow = await db.queryOne(`
    SELECT COALESCE(SUM(quantity * unit_cost), 0) as total
    FROM shop_tabs
    WHERE direction = 'in' AND settled = 1
      AND date(settled_at, '+5 hours', '+45 minutes') = ?
  `, [targetDate]);

  const expensesTotal       = Number(expensesRow?.total || 0);
  const supplierPayments    = Number(supplierRow?.total || 0);

  // Build per-method breakdown
  const methods = {};
  METHODS.forEach(m => {
    methods[m] = { opening: opening[m], productSales: 0, repairSales: 0, inflows: 0, outflows: 0, balance: 0 };
  });

  productSales.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    methods[m].productSales += Number(r.total);
  });
  repairSales.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    methods[m].repairSales += Number(r.total);
  });

  METHODS.forEach(m => {
    const d = methods[m];
    d.inflows  = d.productSales + d.repairSales;
    d.outflows = m === 'Cash' ? expensesTotal + supplierPayments : 0;
    d.balance  = d.opening + d.inflows - d.outflows;
  });

  // History: last 30 days — four separate aggregates, merged in JS
  const [histProd, histRepair, histExp, histSupplier] = await Promise.all([
    db.query(`
      SELECT date(s.created_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(si.quantity*si.unit_price),0) as total
      FROM sales s JOIN sale_items si ON si.sale_id=s.id
      WHERE si.product_id IS NOT NULL AND s.payment_method != 'Credit'
        AND date(s.created_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(s.created_at,'+5 hours','+45 minutes')
    `),
    db.query(`
      SELECT date(created_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(customer_price),0) as total
      FROM repairs WHERE status IN ('Done','Delivered') AND payment_method != 'Credit'
        AND date(created_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(created_at,'+5 hours','+45 minutes')
    `),
    db.query(`
      SELECT expense_date as date, COALESCE(SUM(amount),0) as total
      FROM expenses
      WHERE expense_date >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY expense_date
    `),
    db.query(`
      SELECT date(settled_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(quantity*unit_cost),0) as total
      FROM shop_tabs WHERE direction='in' AND settled=1
        AND date(settled_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(settled_at,'+5 hours','+45 minutes')
    `),
  ]);

  const histMap = {};
  function addHist(rows, key) {
    rows.forEach(r => {
      if (!r.date) return;
      if (!histMap[r.date]) histMap[r.date] = { date: r.date, product_sales: 0, repair_sales: 0, expenses: 0, supplier_payments: 0 };
      histMap[r.date][key] += Number(r.total);
    });
  }
  addHist(histProd,     'product_sales');
  addHist(histRepair,   'repair_sales');
  addHist(histExp,      'expenses');
  addHist(histSupplier, 'supplier_payments');
  const history = Object.values(histMap).sort((a, b) => b.date.localeCompare(a.date));

  res.json({ date: targetDate, methods, expenses: expensesTotal, supplierPayments, history });
}
