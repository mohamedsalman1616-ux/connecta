import { Router } from 'express'; import bcrypt from 'bcryptjs'; import { z } from 'zod';
import { User } from '../models'; import { requireAuth, session } from '../middleware/auth';
const r = Router();
const creds = z.object({ username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/), password: z.string().min(6).max(72) });
r.post('/register', async (req, res) => {
  const p = creds.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Username: 3-20 letters/numbers/_ . Password: 6+ characters.' });
  const username = p.data.username.toLowerCase();
  if (await User.exists({ username })) return res.status(409).json({ error: 'Username already taken' });
  const u = await User.create({ username, displayName: username, passwordHash: await bcrypt.hash(p.data.password, 10), role: 'Staff' });
  res.json(session(u));
});
r.post('/login', async (req, res) => {
  const p = creds.safeParse(req.body); const u = p.success ? await User.findOne({ username: p.data.username.toLowerCase() }) : null;
  if (!p.success || !u || !(await bcrypt.compare(p.data.password, u.passwordHash))) return res.status(401).json({ error: 'Invalid username or password' });
  res.json(session(u));
});
// Server-side logout: bumping tokenVersion invalidates every token issued so far.
r.post('/logout', requireAuth, async (req: any, res) => { await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 }, online: false, lastSeen: new Date() }); res.json({ ok: true }); });
export default r;
