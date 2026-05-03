import { getDb } from '../../../lib/db';
import { signToken } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { role, password } = req.body;
  if (!role || !password) return res.status(400).json({ error: 'Missing fields' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE role = ?').get(role);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });

  const token = await signToken({ id: user.id, username: user.username, role: user.role });

  res.setHeader('Set-Cookie', [
    `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 12}`,
  ]);
  res.json({ ok: true, role: user.role });
}
