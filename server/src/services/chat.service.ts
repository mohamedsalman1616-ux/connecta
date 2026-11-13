import { Message, GroupMember, Group, Notification, User } from '../models';
import { projectForViewer, Viewer } from './permission.service';
import { io, room } from '../socket';

/** Single choke point for what a given viewer receives. Returns null when they may not see the message. */
export function present(msg: any, viewer: Viewer) {
  const p = projectForViewer(msg, viewer); if (!p) return null;
  p.starred = (msg.starredBy ?? []).includes(viewer.id);
  delete p.starredBy; delete p.reports; delete p.__v; return p;
}
export const dmAlive = (m: any) => !(m.disappear && m.perm?.expiresAt && new Date(m.perm.expiresAt) <= new Date());
export async function recipients(msg: any): Promise<Viewer[]> {
  if (msg.groupId) return (await GroupMember.find({ groupId: msg.groupId }).lean()).map(m => ({ id: String(m.userId), role: m.role }));
  return [String(msg.senderId), String(msg.toUserId)].map(id => ({ id, role: '' }));
}
/** Per-recipient delivery: each user gets only their own projection, or nothing. Notifications never carry content. */
export async function fanOut(msg: any, event: 'message:new' | 'message:updated') {
  const sender: any = await User.findById(msg.senderId).select('username displayName').lean();
  const group: any = msg.groupId ? await Group.findById(msg.groupId).select('name').lean() : null;
  const delivered: string[] = [];
  for (const v of await recipients(msg)) {
    const view = present(msg, v); if (!view) continue;
    io.to(room(v.id)).emit(event, view);
    if (event !== 'message:new' || v.id === String(msg.senderId)) continue;
    if ((await io.in(room(v.id)).fetchSockets()).length) delivered.push(v.id);
    if (await User.exists({ _id: v.id, blocked: msg.senderId })) continue;
    const who = sender?.displayName || sender?.username;
    const text = msg.perm?.viewMode === 'custom' ? `New confidential message${group ? ` in ${group.name}` : ''}` : `New message from ${who}${group ? ` in ${group.name}` : ''}`;
    const n = await Notification.create({ userId: v.id, type: 'message', text, data: { groupId: msg.groupId ? String(msg.groupId) : undefined, fromUserId: String(msg.senderId) } });
    io.to(room(v.id)).emit('notification', { id: String(n._id), text, data: n.data, createdAt: (n as any).createdAt });
  }
  if (delivered.length) {
    await Message.updateOne({ _id: msg._id }, { $addToSet: { deliveredTo: { $each: delivered } } });
    io.to(room(String(msg.senderId))).emit('receipt', { messageId: String(msg._id), deliveredTo: delivered });
  }
}
const search = (list: any[], q?: string) => q ? list.filter(m => (m.content ?? '').toLowerCase().includes(q.toLowerCase())) : list;
/** Filter FIRST, then search, so search can never reveal hidden content. */
export async function listGroup(groupId: string, viewer: Viewer, q?: string) {
  const msgs = await Message.find({ groupId, deleted: { $ne: true } }).sort({ createdAt: 1 }).limit(500).lean();
  return search(msgs.map(m => present(m, viewer)).filter(Boolean) as any[], q);
}
export async function listDm(me: string, other: string, q?: string) {
  const msgs = await Message.find({ groupId: null, deleted: { $ne: true }, $or: [{ senderId: me, toUserId: other }, { senderId: other, toUserId: me }] }).sort({ createdAt: 1 }).limit(500).lean();
  return search(msgs.filter(dmAlive).map(m => present(m, { id: me, role: '' })).filter(Boolean) as any[], q);
}
const preview = (m: any) => m ? { content: String(m.content ?? '').slice(0, 80), hasFile: !!m.attachments?.length, senderId: m.senderId, createdAt: m.createdAt } : null;
/** WhatsApp-style chat list: groups + DMs, last visible message, unread count. */
export async function chatList(me: string) {
  const out: any[] = [];
  const mems = await GroupMember.find({ userId: me }).lean();
  for (const g of await Group.find({ _id: { $in: mems.map(m => m.groupId) } }).lean()) {
    const v = { id: me, role: mems.find(m => String(m.groupId) === String(g._id))!.role };
    const msgs = await Message.find({ groupId: g._id, deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(100).lean();
    const vis = msgs.map(m => present(m, v)).filter(Boolean) as any[];
    out.push({ type: 'group', id: String(g._id), name: g.name, hasPhoto: !!g.photo, last: preview(vis[0]), unread: vis.filter(m => m.senderId !== me && !(m.readBy ?? []).includes(me)).length, updatedAt: vis[0]?.createdAt ?? (g as any).createdAt });
  }
  const dms = (await Message.find({ groupId: null, deleted: { $ne: true }, $or: [{ senderId: me }, { toUserId: me }] }).sort({ createdAt: -1 }).limit(300).lean()).filter(dmAlive);
  const by = new Map<string, any[]>();
  for (const m of dms) { const o = String(m.senderId) === me ? String(m.toUserId) : String(m.senderId); by.set(o, [...(by.get(o) ?? []), m]); }
  for (const u of await User.find({ _id: { $in: [...by.keys()] } }).select('username displayName online lastSeen avatar').lean()) {
    const ms = by.get(String(u._id))!;
    out.push({ type: 'dm', id: String(u._id), name: u.displayName || u.username, username: u.username, online: u.online, lastSeen: u.lastSeen, hasPhoto: !!u.avatar, last: preview(ms[0]), unread: ms.filter(m => String(m.senderId) !== me && !(m.readBy ?? []).includes(me)).length, updatedAt: (ms[0] as any).createdAt });
  }
  return out.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}
