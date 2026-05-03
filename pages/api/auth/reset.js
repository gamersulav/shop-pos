import { getDb } from '../../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const secret = process.env.RESET_SECRET;
  if (!secret) return res.status(404).end();
  if (req.query.secret !== secret) return res.status(403).json({ error: 'Wrong secret' });

  const db = await getDb();
  const hash = await bcrypt.hash('owner123', 10);
  await db.run("UPDATE users SET password_hash=? WHERE role='owner'", [hash]);

  res.json({ ok: true, message: 'Owner password reset to: owner123' });
}
