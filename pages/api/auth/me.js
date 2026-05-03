import { getSession } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  res.json({ id: session.id, username: session.username, role: session.role });
}
