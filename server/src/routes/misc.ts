import { Router } from 'express'; import { z } from 'zod';
import { Notification, Story, Contact, User, Report, Message } from '../models'; import { requireAuth, requireAuthOrQuery, guardIds } from '../middleware/auth';
import { accessFor, OID } from '../services/access.service'; import { abilities } from '../services/permission.service'; import { ownedUpload, sendStored, KEY } from './files'; import { Upload } from '../models';
const r = Router(); r.param('id', guardIds);
r.get('/notifications', requireAuth, async (req: any, res) => res.json({
  items: await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(), unread: await Notification.countDocuments({ userId: req.user.id, read: false }) }));
r.post('/notifications/read', requireAuth, async (req: any, res) => { await Notification.updateMany({ userId: req.user.id, read: false }, { read: true }); res.json({ ok: true }); });
// Reports
r.post('/reports', requireAuth, async (req: any, res) => {
  const p = z.object({ type: z.enum(['user', 'message']), targetId: z.string().regex(OID), reason: z.string().trim().min(3).max(500) }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Provide a reason (3-500 chars)' });
  let snapshot: any;
  if (p.data.type === 'message') { // only messages the reporter can see can be reported; snapshot preserves evidence
    const m: any = await Message.findById(p.data.targetId).lean(), v = m && await accessFor(m, req.user.id);
    if (!m || !v || !abilities(m, v).view) return res.status(404).json({ error: 'Message not found' });
    snapshot = { content: m.content, senderId: m.senderId, groupId: m.groupId }; await Message.updateOne({ _id: m._id }, { $addToSet: { reports: req.user.id } });
  } else if (!(await User.exists({ _id: p.data.targetId }))) return res.status(404).json({ error: 'User not found' });
  await Report.create({ reporterId: req.user.id, ...p.data, snapshot }); res.json({ ok: true });
});
r.get('/reports', requireAuth, async (req: any, res) => ['Manager', 'General Manager', 'Headmaster'].includes(req.user.role) ? res.json(await Report.find().sort({ createdAt: -1 }).limit(100).lean()) : res.status(403).json({ error: 'Moderators only' }));
// Stories (24h, visible to the owner and people the owner has as contacts)
async function canSee(s: any, me: string) {
  if (String(s.userId) === me) return true;
  return !!(await Contact.exists({ owner: s.userId, contact: me })) && !(await User.exists({ _id: s.userId, blocked: me })) && !(await User.exists({ _id: me, blocked: s.userId }));
}
r.post('/stories', requireAuth, async (req: any, res) => {
  const p = z.object({ text: z.string().max(300).optional(), bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), mediaKey: z.string().regex(KEY).optional() }).refine(s => s.text || s.mediaKey).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Add text or media' });
  let mime: string | undefined; if (p.data.mediaKey) { const f = await ownedUpload(p.data.mediaKey, req.user.id); if (!f || !/^(image|video)\//.test(f.mime!)) return res.status(400).json({ error: 'Invalid media' }); mime = f.mime!; }
  const s = await Story.create({ userId: req.user.id, text: p.data.text, bg: p.data.bg, mediaKey: p.data.mediaKey, mediaMime: mime, expiresAt: new Date(Date.now() + 24 * 3600 * 1000) }); res.json(s);
});
r.get('/stories', requireAuth, async (req: any, res) => {
  const me = req.user.id; const mine = await Contact.find({ owner: me }).lean();
  const owners = [me, ...mine.map(c => String(c.contact))];
  const stories = (await Story.find({ userId: { $in: owners }, expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).lean()).filter(() => true);
  const visible: any[] = []; for (const s of stories) if (await canSee(s, me)) visible.push(s);
  const users = await User.find({ _id: { $in: [...new Set(visible.map(s => String(s.userId)))] } }).select('username displayName avatar').lean();
  res.json(users.map(u => ({ user: { id: String(u._id), username: u.username, displayName: u.displayName }, stories: visible.filter(s => String(s.userId) === String(u._id)).map(s => ({
    id: String(s._id), text: s.text, bg: s.bg, hasMedia: !!s.mediaKey, mediaMime: s.mediaMime, createdAt: (s as any).createdAt, expiresAt: s.expiresAt,
    viewed: s.viewers.some((v: any) => String(v.userId) === me), viewerCount: String(u._id) === me ? s.viewers.length : undefined })) })));
});
r.post('/stories/:id/view', requireAuth, async (req: any, res) => {
  const s: any = await Story.findById(req.params.id).lean(); if (!s || s.expiresAt < new Date() || !(await canSee(s, req.user.id))) return res.status(404).json({ error: 'Story not found' });
  if (String(s.userId) !== req.user.id) await Story.updateOne({ _id: s._id, 'viewers.userId': { $ne: req.user.id } }, { $push: { viewers: { userId: req.user.id, at: new Date() } } }); res.json({ ok: true });
});
r.get('/stories/:id/media', requireAuthOrQuery, async (req: any, res) => {
  const s: any = await Story.findById(req.params.id).lean(); if (!s?.mediaKey || s.expiresAt < new Date() || !(await canSee(s, req.user.id))) return res.status(404).end();
  const f = await Upload.findOne({ key: s.mediaKey }).lean(); f ? sendStored(res, f.key!, f.mime!, f.name!, false) : res.status(404).end();
});
r.delete('/stories/:id', requireAuth, async (req: any, res) => { await Story.deleteOne({ _id: req.params.id, userId: req.user.id }); res.json({ ok: true }); });
export default r;
