import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';
import { SALE_PROFIT } from '../../../lib/finance';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session || session.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (!process.env.GEMINI_API_KEY) return res.json({ insights: null });

  const db = await getDb();
  const [thisMonth, lastMonth, topProducts, phones, repairs, expenses, profit] = await Promise.all([
    db.queryOne(`SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as rev FROM sales WHERE strftime('%Y-%m',created_at,'+5 hours','+45 minutes')=strftime('%Y-%m','now','+5 hours','+45 minutes')`),
    db.queryOne(`SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as rev FROM sales WHERE strftime('%Y-%m',created_at,'+5 hours','+45 minutes')=strftime('%Y-%m',date('now','-1 month'),'+5 hours','+45 minutes')`),
    db.query(`SELECT si.product_name, SUM(si.quantity) as qty FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE strftime('%Y-%m',s.created_at,'+5 hours','+45 minutes')=strftime('%Y-%m','now','+5 hours','+45 minutes') GROUP BY si.product_name ORDER BY qty DESC LIMIT 5`),
    db.queryOne(`SELECT COUNT(*) as total, SUM(CASE WHEN status='available' AND selling_price=0 THEN 1 ELSE 0 END) as unpriced FROM used_phones WHERE status='available'`),
    db.queryOne(`SELECT COUNT(*) as c FROM repairs WHERE status IN ('Pending','In Progress','Done')`),
    db.queryOne(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE strftime('%Y-%m',created_at,'+5 hours','+45 minutes')=strftime('%Y-%m','now','+5 hours','+45 minutes')`),
    db.queryOne(`SELECT COALESCE(SUM(${SALE_PROFIT}),0) as p FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE strftime('%Y-%m',s.created_at,'+5 hours','+45 minutes')=strftime('%Y-%m','now','+5 hours','+45 minutes')`),
  ]);

  const revChange = lastMonth?.rev > 0
    ? (((thisMonth?.rev - lastMonth?.rev) / lastMonth?.rev) * 100).toFixed(1)
    : null;

  const context = [
    `This month: ${thisMonth?.cnt || 0} sales, Rs ${Number(thisMonth?.rev || 0).toFixed(0)} revenue, Rs ${Number(profit?.p || 0).toFixed(0)} estimated profit`,
    `Last month: ${lastMonth?.cnt || 0} sales, Rs ${Number(lastMonth?.rev || 0).toFixed(0)} revenue`,
    revChange !== null ? `Revenue change vs last month: ${revChange > 0 ? '+' : ''}${revChange}%` : '',
    `This month expenses: Rs ${Number(expenses?.total || 0).toFixed(0)}`,
    `Top products this month: ${topProducts.length ? topProducts.map(p => `${p.product_name}(${p.qty})`).join(', ') : 'no data yet'}`,
    `Phones in stock: ${phones?.total || 0} available, ${phones?.unpriced || 0} not yet priced`,
    `Active repairs: ${repairs?.c || 0}`,
  ].filter(Boolean).join('\n');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, { apiVersion: 'v1' });
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(
    `You are a business advisor for a mobile phone shop in Nepal (Kathmandu). Based on this month's data, give exactly 3 bullet points:\n• A prediction for next month based on the trend\n• A specific recommendation to increase profit or sales\n• One operational improvement to action this week\nEach bullet: 1-2 sentences, specific to the numbers given. Use • as bullet marker. No intro text.\n\n${context}`
  );

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
  return res.json({ insights: result.response.text() || null });
}
