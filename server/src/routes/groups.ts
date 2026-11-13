import { Router } from 'express'; import crypto from 'crypto'; import { z } from 'zod';
import { User, Group, GroupMember, Message } from '../models'; import { requireAuth, requireAuthOrQuery, guardIds } from '../middleware/auth';
import { viewerFor, membership, isMod } from '../services/access.service'; import { io, room } from '../socket';
import { present, chatList, listGroup } from '../services/chat.service'; import { ownedUpload, sendStored, KEY } from './files'; import { Upload } from '../models';
const r = Router(); r.param('id', guardIds); r.param('userId', guardIds);
const role = z.string().trim().min(1).max(20);
const code = () => crypto.randomBytes(6).toString('hex');
const emitTo = (ids: string[], ev: string, p: any) => ids.forEach(i => io.to(room(i)).emit(ev, p));
const member = async (req: any, res: any) => { const m: any = await membership(req.params.id, req.user.id); if (!m) { res.status(403).json({ error: 'You are not a member of this group' }); return null; } return m; };
const modOnly = async (req: any, res: any) => { const m = await member(req, res); if (m && !isMod(m)) { res.status(403).json({ error: 'Only group admins can do this' }); return null; } return m; };
r.get('/chats', requireAuth, async (req: any, res) => res.json(await chatList(req.user.id)));
r.post('/groups', requireAuth, async (req: any, res) => {
  const p = z.object({ name: z.string().trim().min(1).max(60), description: z.string().max(300).optional(), photoKey: z.string().regex(KEY).optional(),
    members: z.array(z.object({ username: z.string().max(20), role: role.optional() })).max(100).default([]) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid group data' });
  if (p.data.photoKey && !(await ownedUpload(p.data.photoKey, req.user.id, 'image/'))) return res.status(400).json({ error: 'Invalid photo' });
  const g = await Group.create({ name: p.data.name, description: p.data.description ?? '', photo: p.data.photoKey, createdBy: req.user.id, inviteCode: code() });
  await GroupMember.create({ groupId: g._id, userId: req.user.id, admin: 'admin', role: req.user.role });
  const wanted = new Map(p.data.members.map(m => [m.username.toLowerCase(), m.role]));
  const users = await User.find({ username: { $in: [...wanted.keys()] }, _id: { $ne: req.user.id }, blocked: { $ne: req.user.id } }).lean();
  if (users.length) await GroupMember.insertMany(users.map(u => ({ groupId: g._id, userId: u._id, role: wanted.get(u.username) ?? u.role })));
  emitTo(users.map(u => String(u._id)), 'group:added', { groupId: String(g._id), name: g.name });
  res.json({ group: g, notFound: [...wanted.keys()].filter(n => !users.some(u => u.username === n)) });
});
r.get('/groups/:id', requireAuth, async (req: any, res) => {
  const m = await member(req, res); if (!m) return; const g: any = await Group.findById(req.params.id).lean();
  res.json({ id: String(g._id), name: g.name, description: g.description, hasPhoto: !!g.photo, announcementsOnly: g.announcementsOnly, createdAt: g.createdAt,
    me: { admin: m.admin, role: m.role }, inviteCode: isMod(m) ? g.inviteCode : undefined, memberCount: await GroupMember.countDocuments({ groupId: g._id }) });
});
r.patch('/groups/:id', requireAuth, async (req: any, res) => {
  if (!(await modOnly(req, res))) return;
  const p = z.object({ name: z.string().trim().min(1).max(60), description: z.string().max(300), announcementsOnly: z.boolean(), photoKey: z.string().regex(KEY) }).partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid data' });
  const { photoKey, ...rest } = p.data; const upd: any = rest;
  if (photoKey) { if (!(await ownedUpload(photoKey, req.user.id, 'image/'))) return res.status(400).json({ error: 'Invalid photo' }); upd.photo = photoKey; }
  const g = await Group.findByIdAndUpdate(req.params.id, upd, { new: true }); res.json(g);
});
r.delete('/groups/:id', requireAuth, async (req: any, res) => {
  const m = await member(req, res); if (!m) return; if (m.admin !== 'admin') return res.status(403).json({ error: 'Only the group admin can delete the group' });
  const ids = (await GroupMember.find({ groupId: req.params.id }).lean()).map(x => String(x.userId));
  await Promise.all([Group.deleteOne({ _id: req.params.id }), GroupMember.deleteMany({ groupId: req.params.id }), Message.deleteMany({ groupId: req.params.id })]);
  emitTo(ids, 'group:removed', { groupId: req.params.id }); res.json({ ok: true });
});
r.get('/groups/:id/photo', requireAuthOrQuery, async (req: any, res) => {
  if (!(await viewerFor(req.params.id, req.user.id))) return res.status(403).end();
  const g: any = await Group.findById(req.params.id).select('photo').lean(); const f = g?.photo && await Upload.findOne({ key: g.photo }).lean();
  f ? sendStored(res, f.key!, f.mime!, f.name!, false) : res.status(404).end();
});
r.get('/groups/:id/members', requireAuth, async (req: any, res) => {
  if (!(await member(req, res))) return;
  const ms = await GroupMember.find({ groupId: req.params.id }).populate('userId', 'username displayName online lastSeen').lean();
  res.json(ms.map((m: any) => ({ userId: String(m.userId._id), username: m.userId.username, displayName: m.userId.displayName, online: m.userId.online, lastSeen: m.userId.lastSeen, role: m.role, admin: m.admin })));
});
r.post('/groups/:id/members', requireAuth, async (req: any, res) => {
  if (!(await modOnly(req, res))) return;
  const p = z.object({ username: z.string().max(20).optional(), userId: z.string().regex(/^[a-f0-9]{24}$/).optional(), role: role.optional() }).safeParse(req.body);
  if (!p.success || (!p.data.username && !p.data.userId)) return res.status(400).json({ error: 'Provide a username or user ID' });
  const u: any = await User.findOne(p.data.userId ? { _id: p.data.userId } : { username: p.data.username!.toLowerCase() }).lean();
  if (!u || (u.blocked ?? []).map(String).includes(req.user.id)) return res.status(404).json({ error: 'User not found' });
  if (await GroupMember.exists({ groupId: req.params.id, userId: u._id })) return res.status(409).json({ error: 'Already a member' });
  await GroupMember.create({ groupId: req.params.id, userId: u._id, role: p.data.role ?? u.role });
  const g: any = await Group.findById(req.params.id).lean(); emitTo([String(u._id)], 'group:added', { groupId: req.params.id, name: g.name }); res.json({ ok: true, username: u.username });
});
r.patch('/groups/:id/members/:userId', requireAuth, async (req: any, res) => {
  const me = await modOnly(req, res); if (!me) return;
  const p = z.object({ role: role.optional(), admin: z.enum(['none', 'coadmin']).optional() }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Invalid data' });
  const t: any = await membership(req.params.id, req.params.userId); if (!t) return res.status(404).json({ error: 'Member not found' });
  if (t.admin === 'admin' && req.params.userId !== req.user.id) return res.status(403).json({ error: 'Cannot modify the group admin' });
  if (p.data.admin !== undefined) { if (me.admin !== 'admin') return res.status(403).json({ error: 'Only the admin can assign co-admins' }); if (t.admin === 'admin') return res.status(400).json({ error: 'Admin level of the owner cannot change' }); }
  if (t.admin === 'coadmin' && me.admin !== 'admin' && req.params.userId !== req.user.id) return res.status(403).json({ error: 'Only the admin can modify a co-admin' });
  await GroupMember.updateOne({ groupId: req.params.id, userId: req.params.userId }, { $set: { ...(p.data.role && { role: p.data.role }), ...(p.data.admin && { admin: p.data.admin }) } });
  res.json({ ok: true }); // role changes apply instantly: message visibility is evaluated per request
});
r.delete('/groups/:id/members/:userId', requireAuth, async (req: any, res) => {
  const me: any = await member(req, res); if (!me) return; const self = req.params.userId === req.user.id;
  const t: any = await membership(req.params.id, req.params.userId); if (!t) return res.status(404).json({ error: 'Member not found' });
  if (!self) {
    if (!isMod(me)) return res.status(403).json({ error: 'Only group admins can remove members' });
    if (t.admin === 'admin' || (t.admin === 'coadmin' && me.admin !== 'admin')) return res.status(403).json({ error: 'You cannot remove this member' });
  }
  await GroupMember.deleteOne({ groupId: req.params.id, userId: req.params.userId });
  if (t.admin === 'admin') { const next: any = await GroupMember.findOne({ groupId: req.params.id }).sort({ admin: 1, createdAt: 1 }); // 'coadmin' sorts before 'none'
    if (next) await GroupMember.updateOne({ _id: next._id }, { admin: 'admin' }); else await Promise.all([Group.deleteOne({ _id: req.params.id }), Message.deleteMany({ groupId: req.params.id })]); }
  emitTo([req.params.userId], 'group:removed', { groupId: req.params.id }); res.json({ ok: true });
});
r.post('/groups/:id/invite/reset', requireAuth, async (req: any, res) => {
  if (!(await modOnly(req, res))) return; const c = code(); await Group.updateOne({ _id: req.params.id }, { inviteCode: c }); res.json({ inviteCode: c });
});
r.post('/groups/join/:code', requireAuth, async (req: any, res) => {
  const g: any = /^[a-f0-9]{12}$/.test(req.params.code) ? await Group.findOne({ inviteCode: req.params.code }).lean() : null;
  if (!g) return res.status(404).json({ error: 'Invalid or expired invite link' });
  const u: any = await User.findById(req.user.id).lean();
  await GroupMember.updateOne({ groupId: g._id, userId: req.user.id }, { $setOnInsert: { role: u.role, admin: 'none' } }, { upsert: true }); res.json({ groupId: String(g._id), name: g.name });
});
r.get('/groups/:id/pinned', requireAuth, async (req: any, res) => {
  const v = await viewerFor(req.params.id, req.user.id); if (!v) return res.status(403).json({ error: 'Not a member' });
  res.json((await Message.find({ groupId: req.params.id, pinned: true, deleted: { $ne: true } }).sort({ createdAt: -1 }).lean()).map(m => present(m, v)).filter(Boolean));
});
r.get('/groups/:id/media', requireAuth, async (req: any, res) => { // gallery lists only attachments this viewer may see
  const v = await viewerFor(req.params.id, req.user.id); if (!v) return res.status(403).json({ error: 'Not a member' });
  res.json((await listGroup(req.params.id, v)).flatMap((m: any) => (m.attachments ?? []).map((a: any) => ({ messageId: String(m._id), ...a }))));
});
export default r;
