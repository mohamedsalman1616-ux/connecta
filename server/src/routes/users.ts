import { Router } from 'express'; import { z } from 'zod';
import { User, Contact } from '../models'; import { requireAuth, requireAuthOrQuery, guardIds, publicSelf } from '../middleware/auth';
import { ownedUpload, sendStored } from './files'; import { Upload } from '../models';
const r = Router(); r.param('id', guardIds);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PUB = 'username displayName bio status online lastSeen avatar role';
const pub = (u: any, hideSeen = false) => ({ id: String(u._id), username: u.username, displayName: u.displayName, bio: u.bio, status: u.status, role: u.role, hasAvatar: !!u.avatar, online: hideSeen ? false : u.online, lastSeen: hideSeen ? null : u.lastSeen });
r.get('/users/me', requireAuth, async (req: any, res) => res.json(publicSelf(await User.findById(req.user.id).lean())));
const settings = z.object({ theme: z.string().max(20), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), fontSize: z.enum(['small', 'medium', 'large']), sound: z.boolean(), soundVolume: z.number().min(0).max(1),
  notifications: z.object({ messages: z.boolean(), groups: z.boolean(), stories: z.boolean(), preview: z.boolean() }).partial(), wallpaper: z.string().max(200), chatWallpapers: z.record(z.string().max(200)) }).partial();
r.patch('/users/me', requireAuth, async (req: any, res) => {
  const p = z.object({ displayName: z.string().trim().min(1).max(40), bio: z.string().max(200), status: z.string().max(80), avatarKey: z.string(), settings }).partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid profile data' });
  const u: any = await User.findById(req.user.id); const d = p.data;
  if (d.displayName !== undefined) u.displayName = d.displayName; if (d.bio !== undefined) u.bio = d.bio; if (d.status !== undefined) u.status = d.status;
  if (d.avatarKey) { if (!(await ownedUpload(d.avatarKey, req.user.id, 'image/'))) return res.status(400).json({ error: 'Invalid avatar' }); u.avatar = d.avatarKey; }
  if (d.settings) { u.settings = { ...(u.settings ?? {}), ...d.settings }; u.markModified('settings'); }
  await u.save(); res.json(publicSelf(u));
});
r.get('/users/search', requireAuth, async (req: any, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase(); if (q.length < 2) return res.json([]);
  const me: any = await User.findById(req.user.id).select('blocked').lean();
  const found = await User.find({ username: { $regex: '^' + esc(q) }, _id: { $ne: req.user.id, $nin: me.blocked ?? [] }, blocked: { $ne: req.user.id } }).select(PUB).limit(20).lean();
  res.json(found.map(u => pub(u)));
});
r.get('/users/blocked', requireAuth, async (req: any, res) => {
  const me: any = await User.findById(req.user.id).select('blocked').lean(); res.json((await User.find({ _id: { $in: me.blocked ?? [] } }).select(PUB).lean()).map(u => pub(u)));
});
r.get('/users/:id', requireAuth, async (req: any, res) => {
  const u: any = await User.findById(req.params.id).select(PUB + ' blocked').lean(); if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(pub(u, (u.blocked ?? []).map(String).includes(req.user.id))); // blocked users can't see presence
});
r.get('/users/:id/avatar', requireAuthOrQuery, async (req: any, res) => {
  const u: any = await User.findById(req.params.id).select('avatar').lean(); const f = u?.avatar && await Upload.findOne({ key: u.avatar }).lean();
  f ? sendStored(res, f.key!, f.mime!, f.name!, false) : res.status(404).end();
});
r.post('/users/:id/block', requireAuth, async (req: any, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot block yourself' });
  if (!(await User.exists({ _id: req.params.id }))) return res.status(404).json({ error: 'User not found' });
  await User.updateOne({ _id: req.user.id }, { $addToSet: { blocked: req.params.id } }); await Contact.deleteOne({ owner: req.user.id, contact: req.params.id }); res.json({ blocked: true });
});
r.delete('/users/:id/block', requireAuth, async (req: any, res) => { await User.updateOne({ _id: req.user.id }, { $pull: { blocked: req.params.id } }); res.json({ blocked: false }); });
// Contacts
r.get('/contacts', requireAuth, async (req: any, res) => {
  const cs = await Contact.find({ owner: req.user.id }).populate('contact', PUB).lean(); res.json(cs.map((c: any) => pub(c.contact)));
});
r.post('/contacts', requireAuth, async (req: any, res) => {
  const p = z.object({ username: z.string().max(20) }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Username required' });
  const u: any = await User.findOne({ username: p.data.username.toLowerCase() }).lean();
  if (!u || String(u._id) === req.user.id || (u.blocked ?? []).map(String).includes(req.user.id)) return res.status(404).json({ error: 'User not found' });
  await Contact.updateOne({ owner: req.user.id, contact: u._id }, {}, { upsert: true }); res.json(pub(u));
});
r.delete('/contacts/:id', requireAuth, async (req: any, res) => { await Contact.deleteOne({ owner: req.user.id, contact: req.params.id }); res.json({ ok: true }); });
export default r;
