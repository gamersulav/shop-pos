import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDb } from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.GEMINI_API_KEY) return res.json({ tip: null });

  const db = await getDb();
  const [pendingRepairs, doneRepairs, pendingNotes, todaySales, lowStock, outOfStock] = await Promise.all([
    db.queryOne(`SELECT COUNT(*) as c FROM repairs WHERE status IN ('Pending','In Progress')`),
    db.queryOne(`SELECT COUNT(*) as c FROM repairs WHERE status='Done'`),
    db.queryOne(`SELECT COUNT(*) as c FROM consignments WHERE status='out'`),
    db.queryOne(`SELECT COUNT(*) as c FROM sales WHERE date(created_at,'+5 hours','+45 minutes')=date('now','+5 hours','+45 minutes')`),
    db.query(`SELECT name, stock FROM products WHERE stock > 0 AND stock <= 5`),
    db.query(`SELECT name FROM products WHERE stock = 0`),
  ]);

  const lines = [
    `Pending/in-progress repairs: ${pendingRepairs?.c || 0}`,
    `Repairs done and awaiting pickup: ${doneRepairs?.c || 0}`,
    `Items out on consignment: ${pendingNotes?.c || 0}`,
    `Sales recorded today: ${todaySales?.c || 0}`,
    lowStock.length   ? `Low stock items: ${lowStock.map(i => `${i.name}(${i.stock})`).join(', ')}` : null,
    outOfStock.length ? `Out of stock: ${outOfStock.map(i => i.name).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, { apiVersion: 'v1' });
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(
    `You are an assistant for a mobile phone shop in Nepal. Based on this shop status, write a 1-2 sentence staff direction — what should staff focus on right now? Be specific and actionable. No greetings, no extra words.\n\n${lines}`
  );

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
  return res.json({ tip: result.response.text() || null });
}
