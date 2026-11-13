import { Router } from 'express'; import { z } from 'zod';
import { User, Group, GroupMember, Message, Upload } from '../models'; import { requireAuth, requireAuthOrQuery, guardIds } from '../middleware/auth';
import { viewerFor, membership, isMod, isBlocked, accessFor, OID } from '../services/access.service';
import { abilities, canEdit, Viewer } from '../services/permission.service';
import { present, fanOut, listGroup, listDm, recipients } from '../services/chat.service'; import { KEY, sendStored } from './files'; import { io, room } from '../socket';
import { recordActivity, getMessageActivity } from '../services/activity.service';
const r = Router(); r.param('id', guardIds); r.param('userId', guardIds);
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
const nm = z.string().trim().min(1).max(20), ids = z.array(z.string().regex(OID)).max(100).default([]);
const permIn = z.object({ viewMode: z.enum(['everyone', 'custom']).default('everyone'), viewRoles: z.array(nm).max(20).default([]), viewMembers: ids,
  editRoles: z.array(nm).max(20).default([]), editMembers: ids, allowCopy: z.boolean().default(false), allowForward: z.boolean().default(false), allowDownload: z.boolean().default(false),
  allowReply: z.boolean().default(true), allowReact: z.boolean().default(true), allowScreenshot: z.boolean().default(true), screenshotProtected: z.boolean().default(false), expiresAt: z.coerce.date().refine(d => d.getTime() > Date.now(), 'Expiry must be in the future').optional() });
const body = z.object({ content: z.string().max(4000).default(''), attachmentKeys: z.array(z.string().regex(KEY)).max(5).default([]), replyTo: z.string().regex(OID).optional(),
  perm: permIn.default({}), disappearSeconds: z.number().int().min(5).max(604800).optional() }).refine(b => clean(b.content) || b.attachmentKeys.length, 'Message is empty');
const DM_PERM = { viewMode: 'everyone', viewRoles: [], viewMembers: [], editRoles: [], editMembers: [], allowCopy: true, allowForward: true, allowDownload: true, allowReply: true, allowReact: true, allowScreenshot: true, screenshotProtected: false };
type Out = { status: number; body: any };
async function createMessage(me: { id: string }, target: { groupId?: string; toUserId?: string }, b: z.infer<typeof body>, extra: any = {}): Promise<Out> {
  let viewer: Viewer | null, perm: any, disappear = false;
  if (target.groupId) {
    viewer = await viewerFor(target.groupId, me.id); if (!viewer) return { status: 403, body: { error: 'You are not a member of this group' } };
    const g: any = await Group.findById(target.groupId).lean(), gm = await membership(target.groupId, me.id);
    if (g?.announcementsOnly && !isMod(gm)) return { status: 403, body: { error: 'Only admins can post in this group' } };
    const chosen = [...new Set([...b.perm.viewMembers, ...b.perm.editMembers])];
    if (chosen.length && (await GroupMember.countDocuments({ groupId: target.groupId, userId: { $in: chosen } })) !== chosen.length) return { status: 400, body: { error: 'Selected members must belong to this group' } };
    perm = b.perm;
  } else {
    const to = target.toUserId!; if (to === me.id) return { status: 400, body: { error: 'You cannot message yourself' } };
    if (!(await User.exists({ _id: to }))) return { status: 404, body: { error: 'User not found' } };
    if (await isBlocked(me.id, to)) return { status: 403, body: { error: 'You cannot message this user' } };
    viewer = { id: me.id, role: '' }; perm = { ...DM_PERM };
    if (b.disappearSeconds) { perm.expiresAt = new Date(Date.now() + b.disappearSeconds * 1000); disappear = true; }
  }
  const files = b.attachmentKeys.length ? await Upload.find({ key: { $in: b.attachmentKeys }, owner: me.id }).lean() : [];
  if (files.length !== new Set(b.attachmentKeys).size) return { status: 400, body: { error: 'Invalid attachment' } };
  let replyTo: string | undefined;
  let parentMsg: any = null;
  if (b.replyTo) {
    const parent: any = await Message.findById(b.replyTo).lean(), pv = parent && await accessFor(parent, me.id);
    const sameChat = parent && (target.groupId ? String(parent.groupId) === target.groupId : !parent.groupId && [String(parent.senderId), String(parent.toUserId)].includes(target.toUserId!));
    if (!parent || !pv || !sameChat || !abilities(parent, pv).reply) return { status: 403, body: { error: 'You cannot reply to that message' } };
    replyTo = b.replyTo;
    parentMsg = parent;
  }
  const msg = await Message.create({ ...target, senderId: me.id, content: clean(b.content), attachments: files.map(f => ({ name: f.name, mime: f.mime, key: f.key })), perm, replyTo, disappear, ...extra });
  const o = msg.toObject(); await fanOut(o, 'message:new');
  if (parentMsg) await recordActivity({ msg: parentMsg, userId: me.id, actionType: 'REPLY', metadata: { replyMessageId: String(msg._id) } });
  return { status: 200, body: present(o, viewer) };
}
const sendOut = (res: any, o: Out) => res.status(o.status).json(o.body);
const parse = (req: any, res: any) => { const p = body.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? 'Invalid message' }); return null; } return p.data; };

r.get('/groups/:id/messages', requireAuth, async (req: any, res) => {
  const v = await viewerFor(req.params.id, req.user.id); if (!v) return res.status(403).json({ error: 'You are not a member of this group' });
  res.json(await listGroup(req.params.id, v, req.query.q as string | undefined));
});
r.post('/groups/:id/messages', requireAuth, async (req: any, res) => { const b = parse(req, res); if (b) sendOut(res, await createMessage(req.user, { groupId: req.params.id }, b)); });
r.get('/dm/:userId/messages', requireAuth, async (req: any, res) => res.json(await listDm(req.user.id, req.params.userId, req.query.q as string | undefined)));
r.post('/dm/:userId/messages', requireAuth, async (req: any, res) => { const b = parse(req, res); if (b) sendOut(res, await createMessage(req.user, { toUserId: req.params.userId }, b)); });

r.get('/messages/starred', requireAuth, async (req: any, res) => {
  const out: any[] = [];
  for (const m of await Message.find({ starredBy: req.user.id, deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(200).lean()) { const v = await accessFor(m, req.user.id); const p = v && present(m, v); if (p) out.push(p); }
  res.json(out);
});
r.post('/messages/read', requireAuth, async (req: any, res) => {
  const p = z.object({ ids: z.array(z.string().regex(OID)).max(100) }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Invalid ids' });
  for (const m of await Message.find({ _id: { $in: p.data.ids }, senderId: { $ne: req.user.id }, readBy: { $ne: req.user.id } }).lean()) {
    const v = await accessFor(m, req.user.id); if (!v || !present(m, v)) continue; // can't "read" what you can't see
    await Message.updateOne({ _id: m._id }, { $addToSet: { readBy: req.user.id } }); io.to(room(m.senderId)).emit('receipt', { messageId: String(m._id), readBy: [req.user.id] });
    await recordActivity({ msg: m, userId: req.user.id, actionType: 'VIEW' });
  }
  res.json({ ok: true });
});
// Loads a message plus the caller's relationship to it. A message the caller can't view is reported as 404, never 403, so existence doesn't leak.
async function load(req: any, res: any) {
  const m: any = await Message.findById(req.params.id).lean(); const v = m && !m.deleted ? await accessFor(m, req.user.id) : null;
  if (!m || !v || !abilities(m, v).view) { res.status(404).json({ error: 'Message not found or you do not have permission to view it' }); return null; }
  return { m, v, can: abilities(m, v) };
}
r.patch('/messages/:id', requireAuth, async (req: any, res) => {
  const c = z.string().max(4000).transform(clean).refine(s => s.length > 0).safeParse(req.body?.content); if (!c.success) return res.status(400).json({ error: 'Invalid content' });
  const x = await load(req, res); if (!x) return;
  if (!canEdit(x.m, x.v)) return res.status(403).json({ error: 'You do not have edit permission for this message' });
  const previousContent = x.m.content;
  const m: any = await Message.findByIdAndUpdate(req.params.id, { content: c.data, edited: true }, { new: true }).lean(); await fanOut(m, 'message:updated');
  await recordActivity({ msg: m, userId: req.user.id, actionType: 'EDIT', metadata: { previousContent, updatedContent: c.data } });
  res.json({ ok: true });
});
r.delete('/messages/:id', requireAuth, async (req: any, res) => {
  const x = await load(req, res); if (!x) return; const gm = x.m.groupId ? await membership(String(x.m.groupId), req.user.id) : null;
  if (x.m.senderId !== req.user.id && !isMod(gm)) return res.status(403).json({ error: 'You can only delete your own messages' });
  await Message.updateOne({ _id: x.m._id }, { deleted: true, content: '', attachments: [] });
  for (const v of await recipients(x.m)) io.to(room(v.id)).emit('message:deleted', { id: String(x.m._id), groupId: x.m.groupId ? String(x.m.groupId) : undefined }); // id only, no content
  res.json({ ok: true });
});
r.post('/messages/:id/react', requireAuth, async (req: any, res) => {
  const e = z.string().min(1).max(8).safeParse(req.body?.emoji); if (!e.success) return res.status(400).json({ error: 'Invalid emoji' });
  const x = await load(req, res); if (!x) return; if (!x.can.react) return res.status(403).json({ error: 'Reactions are not allowed on this message' });
  const had = (x.m.reactions ?? []).some((r: any) => r.userId === req.user.id && r.emoji === e.data);
  const m: any = await Message.findByIdAndUpdate(x.m._id, had ? { $pull: { reactions: { userId: req.user.id, emoji: e.data } } } : { $push: { reactions: { userId: req.user.id, emoji: e.data } } }, { new: true }).lean();
  await fanOut(m, 'message:updated');
  if (!had) await recordActivity({ msg: m, userId: req.user.id, actionType: 'REACT', metadata: { emoji: e.data } });
  res.json({ ok: true });
});
r.post('/messages/:id/star', requireAuth, async (req: any, res) => {
  const x = await load(req, res); if (!x) return; const on = !(x.m.starredBy ?? []).includes(req.user.id);
  await Message.updateOne({ _id: x.m._id }, on ? { $addToSet: { starredBy: req.user.id } } : { $pull: { starredBy: req.user.id } }); res.json({ starred: on });
});
r.post('/messages/:id/pin', requireAuth, async (req: any, res) => {
  const x = await load(req, res); if (!x) return;
  if (x.m.groupId && !isMod(await membership(String(x.m.groupId), req.user.id))) return res.status(403).json({ error: 'Only group admins can pin messages' });
  const m: any = await Message.findByIdAndUpdate(x.m._id, { pinned: !x.m.pinned }, { new: true }).lean(); await fanOut(m, 'message:updated'); res.json({ pinned: m.pinned });
});
r.post('/messages/:id/forward', requireAuth, async (req: any, res) => {
  const p = z.object({ groupId: z.string().regex(OID).optional(), userId: z.string().regex(OID).optional() }).refine(t => !!t.groupId !== !!t.userId).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Choose one destination' });
  const x = await load(req, res); if (!x) return;
  if (!x.can.forward) return res.status(403).json({ error: 'Forwarding is not permitted for this message' });
  const keys = (x.m.attachments ?? []).map((a: any) => a.key);
  // Forwarded copy is a NEW message owned by the forwarder with default permissions; attachments are copied by reference.
  const copy = { content: x.m.content, attachmentKeys: [], perm: permIn.parse({}), replyTo: undefined, disappearSeconds: undefined } as any;
  const originalMessageId = x.m.originalMessageId || x.m._id;
  const out = await createMessage(req.user, p.data.groupId ? { groupId: p.data.groupId } : { toUserId: p.data.userId }, { ...copy, content: x.m.content || ' ' }, { forwarded: true, originalMessageId, attachments: (x.m.attachments ?? []).map((a: any) => ({ name: a.name, mime: a.mime, key: a.key })) });
  if (out.status === 200) {
    let destinationName = '';
    if (p.data.groupId) {
      const g: any = await Group.findById(p.data.groupId).select('name').lean();
      destinationName = g?.name || 'Group';
    } else if (p.data.userId) {
      const u: any = await User.findById(p.data.userId).select('displayName username').lean();
      destinationName = u?.displayName || u?.username || 'User';
    }
    await recordActivity({
      msg: x.m,
      userId: req.user.id,
      actionType: 'FORWARD',
      destinationType: p.data.groupId ? 'group' : 'dm',
      destinationId: p.data.groupId ?? p.data.userId ?? null,
      destinationName,
    });
  }
  void keys; sendOut(res, out);
});
// Authorized file streaming. Keys never reach clients; view needs `view`, ?dl=1 needs `download`.
r.get('/messages/:id/files/:idx', requireAuthOrQuery, async (req: any, res) => {
  const x = await load(req, res); if (!x) return; const a = (x.m.attachments ?? [])[Number(req.params.idx)]; if (!a) return res.status(404).end();
  const dl = req.query.dl === '1'; if (dl && !x.can.download) return res.status(403).json({ error: 'Downloading is not permitted for this message' });
  if (dl) await recordActivity({ msg: x.m, userId: req.user.id, actionType: 'DOWNLOAD', metadata: { fileName: a.name, fileType: a.mime } });
  sendStored(res, a.key, a.mime, a.name, dl);
});
r.post('/messages/:id/copy', requireAuth, async (req: any, res) => {
  const x = await load(req, res); if (!x) return;
  if (!x.can.copy || x.can.screenshotProtected) return res.status(403).json({ error: 'Copying is not permitted for this message' });
  await recordActivity({ msg: x.m, userId: req.user.id, actionType: 'COPY' });
  res.json({ ok: true });
});
r.get('/messages/:id/activity', requireAuth, async (req: any, res) => {
  sendOut(res, await getMessageActivity(req.params.id, req.user.id));
});
r.post('/messages/:id/screenshot-alert', requireAuth, async (req: any, res) => {
  const x = await load(req, res); if (!x) return;
  const user: any = await User.findById(req.user.id).select('username displayName').lean();
  const userName = user?.displayName || user?.username || 'A member';
  // If the message has screenshot restrictions or protection, notify the sender and recipients
  const text = `⚠️ Screenshot attempt detected by ${userName} on protected message.`;
  if (x.m.senderId && x.m.senderId !== req.user.id) {
    io.to(room(x.m.senderId)).emit('notification', { id: `alert-${Date.now()}`, text, data: { groupId: x.m.groupId ? String(x.m.groupId) : undefined, messageId: String(x.m._id) }, createdAt: new Date().toISOString() });
  }
  res.json({ ok: true, alerted: true });
});
export default r;
