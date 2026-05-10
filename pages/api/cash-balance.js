import { getDb } from '../../lib/db';
import { getSession } from '../../lib/auth';

const METHODS = ['Cash', 'eSewa', 'Bank Transfer', 'Fonepay'];

function prevDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

async function computeClosingForDate(db, date, depth = 0) {
  const [openRows, saleRows, repairRows, expRow, suppRow, creditSaleRows, creditRepairRows] = await Promise.all([
    db.query(`SELECT payment_method, amount, COALESCE(adjustment,0) as adjustment FROM cash_opening WHERE date=?`, [date]),
    db.query(`
      SELECT s.payment_method, COALESCE(SUM(si.quantity*si.unit_price - COALESCE(si.item_discount,0)),0) as total
      FROM sales s JOIN sale_items si ON si.sale_id=s.id
      WHERE si.product_id IS NOT NULL AND s.payment_method!='Credit' AND date(s.created_at,'+5 hours','+45 minutes')=?
      GROUP BY s.payment_method
    `, [date]),
    db.query(`
      SELECT payment_method, COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as total
      FROM repairs WHERE status IN ('Done','Delivered') AND payment_method!='Credit'
        AND date(created_at,'+5 hours','+45 minutes')=?
      GROUP BY payment_method
    `, [date]),
    db.query(`SELECT COALESCE(payment_method,'Cash') as payment_method, COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date=? GROUP BY payment_method`, [date]),
    db.queryOne(`SELECT COALESCE(SUM(quantity*unit_cost),0) as total FROM shop_tabs WHERE direction='in' AND settled=1 AND date(settled_at,'+5 hours','+45 minutes')=?`, [date]),
    db.query(`
      SELECT cleared_payment_method as payment_method,
             COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as total
      FROM sales
      WHERE payment_method='Credit' AND credit_cleared=1 AND cleared_payment_method IS NOT NULL
        AND date(credit_cleared_at,'+5 hours','+45 minutes')=?
      GROUP BY cleared_payment_method
    `, [date]),
    db.query(`
      SELECT cleared_payment_method as payment_method,
             COALESCE(SUM(customer_price - COALESCE(credit_discount,0)),0) as total
      FROM repairs
      WHERE payment_method='Credit' AND credit_cleared=1 AND cleared_payment_method IS NOT NULL
        AND date(credit_cleared_at,'+5 hours','+45 minutes')=?
      GROUP BY cleared_payment_method
    `, [date]),
  ]);

  const open = {}, adj = {}, sales = {}, repairs = {}, expByMethod = {}, creditSales = {}, creditRepairs = {};
  METHODS.forEach(m => { open[m] = 0; adj[m] = 0; sales[m] = 0; repairs[m] = 0; expByMethod[m] = 0; creditSales[m] = 0; creditRepairs[m] = 0; });

  const explicitMethods = new Set();
  openRows.forEach(r => {
    open[r.payment_method] = Number(r.amount);
    adj[r.payment_method] = Number(r.adjustment) || 0;
    explicitMethods.add(r.payment_method);
  });

  const needsCarry = METHODS.filter(m => !explicitMethods.has(m));
  if (needsCarry.length > 0 && depth < 60) {
    const prevClosing = await computeClosingForDate(db, prevDateStr(date), depth + 1);
    needsCarry.forEach(m => { open[m] = prevClosing[m] || 0; });
  }

  saleRows.forEach(r => { if (METHODS.includes(r.payment_method)) sales[r.payment_method] = Number(r.total); });
  repairRows.forEach(r => { if (METHODS.includes(r.payment_method)) repairs[r.payment_method] = Number(r.total); });
  expRow.forEach(r => { if (METHODS.includes(r.payment_method)) expByMethod[r.payment_method] = Number(r.total); });
  creditSaleRows.forEach(r => { if (METHODS.includes(r.payment_method)) creditSales[r.payment_method] = Number(r.total); });
  creditRepairRows.forEach(r => { if (METHODS.includes(r.payment_method)) creditRepairs[r.payment_method] = Number(r.total); });

  const supplier = Number(suppRow?.total || 0);

  const closing = {};
  METHODS.forEach(m => {
    const out = expByMethod[m] + (m === 'Cash' ? supplier : 0);
    closing[m] = open[m] + sales[m] + repairs[m] + creditSales[m] + creditRepairs[m] - out + adj[m];
  });
  return closing;
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const db = await getDb();

  if (req.method === 'POST') {
    if (session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const { date, payment_method, amount } = req.body;
    if (!date || !payment_method) return res.status(400).json({ error: 'date and payment_method required' });
    await db.run(
      `INSERT INTO cash_opening (date,payment_method,amount,adjustment) VALUES (?,?,?,0)
       ON CONFLICT(date,payment_method) DO UPDATE SET amount=excluded.amount`,
      [date, payment_method, Math.abs(Number(amount)) || 0]
    );
    return res.json({ ok: true });
  }

  if (req.method === 'PUT') {
    const { date, payment_method, adjustment } = req.body;
    if (!date || !payment_method) return res.status(400).json({ error: 'date and payment_method required' });
    await db.run(
      `INSERT INTO cash_opening (date,payment_method,amount,adjustment) VALUES (?,?,0,?)
       ON CONFLICT(date,payment_method) DO UPDATE SET adjustment=excluded.adjustment`,
      [date, payment_method, Number(adjustment) || 0]
    );
    return res.json({ ok: true });
  }

  if (req.method !== 'GET') return res.status(405).end();

  const { d: todayNPT } = await db.queryOne(`SELECT date('now','+5 hours','+45 minutes') as d`);
  const targetDate = req.query.date || todayNPT;

  // Opening: explicit from DB or auto-carry-forward from previous day's closing
  const openingRows = await db.query(
    `SELECT payment_method, amount, COALESCE(adjustment,0) as adjustment FROM cash_opening WHERE date=?`, [targetDate]
  );
  const opening = {}, hasExplicit = {}, adjustment = {};
  METHODS.forEach(m => { opening[m] = 0; hasExplicit[m] = false; adjustment[m] = 0; });
  openingRows.forEach(r => {
    opening[r.payment_method] = Number(r.amount);
    hasExplicit[r.payment_method] = true;
    adjustment[r.payment_method] = Number(r.adjustment) || 0;
  });

  const needsCarry = METHODS.filter(m => !hasExplicit[m]);
  if (needsCarry.length > 0) {
    const prevClosing = await computeClosingForDate(db, prevDateStr(targetDate));
    needsCarry.forEach(m => { opening[m] = prevClosing[m] || 0; });
  }

  // Individual transactions
  const [saleRows, repairRows, expenseRows, supplierRows, creditSaleTxRows, creditRepairTxRows] = await Promise.all([
    db.query(`
      SELECT s.id, s.created_at, s.payment_method,
             GROUP_CONCAT(si.product_name || ' ×' || si.quantity) as items,
             SUM(si.quantity*si.unit_price - COALESCE(si.item_discount,0)) as amount
      FROM sales s JOIN sale_items si ON si.sale_id=s.id
      WHERE si.product_id IS NOT NULL AND s.payment_method!='Credit' AND date(s.created_at,'+5 hours','+45 minutes')=?
      GROUP BY s.id
    `, [targetDate]),
    db.query(`
      SELECT id, customer_name, issue, payment_method, created_at,
             customer_price - COALESCE(repair_discount,0) as amount
      FROM repairs WHERE status IN ('Done','Delivered') AND payment_method!='Credit'
        AND date(created_at,'+5 hours','+45 minutes')=?
    `, [targetDate]),
    db.query(`SELECT description, amount, created_at, COALESCE(payment_method,'Cash') as payment_method FROM expenses WHERE expense_date=?`, [targetDate]),
    db.query(`
      SELECT shop_name, quantity*unit_cost as amount, settled_at
      FROM shop_tabs WHERE direction='in' AND settled=1
        AND date(settled_at,'+5 hours','+45 minutes')=?
    `, [targetDate]),
    db.query(`
      SELECT id, credit_cleared_at as created_at, cleared_payment_method as payment_method,
             credit_customer as customer_name,
             total_amount - COALESCE(credit_discount,0) as amount
      FROM sales
      WHERE payment_method='Credit' AND credit_cleared=1 AND cleared_payment_method IS NOT NULL
        AND date(credit_cleared_at,'+5 hours','+45 minutes')=?
    `, [targetDate]),
    db.query(`
      SELECT id, credit_cleared_at as created_at, cleared_payment_method as payment_method,
             customer_name,
             customer_price - COALESCE(credit_discount,0) as amount
      FROM repairs
      WHERE payment_method='Credit' AND credit_cleared=1 AND cleared_payment_method IS NOT NULL
        AND date(credit_cleared_at,'+5 hours','+45 minutes')=?
    `, [targetDate]),
  ]);

  const methods = {};
  METHODS.forEach(m => {
    methods[m] = { opening: opening[m], adjustment: adjustment[m], inflows: 0, outflows: 0, balance: 0, transactions: [] };
  });

  saleRows.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    const amt = Number(r.amount);
    methods[m].inflows += amt;
    methods[m].transactions.push({ kind: 'sale', description: r.items, amount: amt, time: r.created_at });
  });

  repairRows.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    const amt = Number(r.amount);
    methods[m].inflows += amt;
    methods[m].transactions.push({ kind: 'repair', description: r.customer_name, amount: amt, time: r.created_at });
  });

  creditSaleTxRows.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    const amt = Number(r.amount);
    methods[m].inflows += amt;
    methods[m].transactions.push({ kind: 'credit', description: `Credit cleared — ${r.customer_name || 'Customer'}`, amount: amt, time: r.created_at });
  });

  creditRepairTxRows.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    const amt = Number(r.amount);
    methods[m].inflows += amt;
    methods[m].transactions.push({ kind: 'credit', description: `Credit cleared — ${r.customer_name || 'Customer'} (repair)`, amount: amt, time: r.created_at });
  });

  const expensesTotal = expenseRows.reduce((s, r) => s + Number(r.amount), 0);
  expenseRows.forEach(r => {
    const m = METHODS.includes(r.payment_method) ? r.payment_method : 'Cash';
    methods[m].transactions.push({ kind: 'expense', description: r.description, amount: -Number(r.amount), time: r.created_at });
    methods[m].outflows += Number(r.amount);
  });

  const supplierTotal = supplierRows.reduce((s, r) => s + Number(r.amount), 0);
  supplierRows.forEach(r => {
    methods['Cash'].transactions.push({ kind: 'supplier', description: `Paid ${r.shop_name}`, amount: -Number(r.amount), time: r.settled_at });
  });
  methods['Cash'].outflows += supplierTotal;

  METHODS.forEach(m => {
    methods[m].transactions.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    methods[m].balance = methods[m].opening + methods[m].inflows - methods[m].outflows + methods[m].adjustment;
  });

  // History: last 30 days
  const [histSale, histRepair, histExp, histSupplier, histCreditSale, histCreditRepair] = await Promise.all([
    db.query(`
      SELECT date(s.created_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(si.quantity*si.unit_price - COALESCE(si.item_discount,0)),0) as total
      FROM sales s JOIN sale_items si ON si.sale_id=s.id
      WHERE si.product_id IS NOT NULL AND s.payment_method!='Credit'
        AND date(s.created_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(s.created_at,'+5 hours','+45 minutes')
    `),
    db.query(`
      SELECT date(created_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(customer_price - COALESCE(repair_discount,0)),0) as total
      FROM repairs WHERE status IN ('Done','Delivered') AND payment_method!='Credit'
        AND date(created_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(created_at,'+5 hours','+45 minutes')
    `),
    db.query(`
      SELECT expense_date as date, COALESCE(SUM(amount),0) as total FROM expenses
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
    db.query(`
      SELECT date(credit_cleared_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(total_amount - COALESCE(credit_discount,0)),0) as total
      FROM sales
      WHERE payment_method='Credit' AND credit_cleared=1 AND cleared_payment_method IS NOT NULL
        AND date(credit_cleared_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(credit_cleared_at,'+5 hours','+45 minutes')
    `),
    db.query(`
      SELECT date(credit_cleared_at,'+5 hours','+45 minutes') as date,
             COALESCE(SUM(customer_price - COALESCE(credit_discount,0)),0) as total
      FROM repairs
      WHERE payment_method='Credit' AND credit_cleared=1 AND cleared_payment_method IS NOT NULL
        AND date(credit_cleared_at,'+5 hours','+45 minutes') >= date('now','-30 days','+5 hours','+45 minutes')
      GROUP BY date(credit_cleared_at,'+5 hours','+45 minutes')
    `),
  ]);

  const histMap = {};
  function addHist(rows, key) {
    rows.forEach(r => {
      if (!r.date) return;
      if (!histMap[r.date]) histMap[r.date] = { date: r.date, sales: 0, repair_sales: 0, expenses: 0, supplier_payments: 0 };
      histMap[r.date][key] += Number(r.total);
    });
  }
  addHist(histSale, 'sales');
  addHist(histRepair, 'repair_sales');
  addHist(histExp, 'expenses');
  addHist(histSupplier, 'supplier_payments');
  addHist(histCreditSale, 'sales');
  addHist(histCreditRepair, 'repair_sales');
  const history = Object.values(histMap).sort((a, b) => b.date.localeCompare(a.date));

  res.json({ date: targetDate, methods, expenses: expensesTotal, supplierPayments: supplierTotal, history });
}
