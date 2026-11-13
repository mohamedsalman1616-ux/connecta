import { GroupMember, User } from '../models';
import type { Viewer } from './permission.service';
export const OID = /^[a-f0-9]{24}$/;
/** The viewer's role is the one stored for THEM in this group, never taken from the client. */
export async function viewerFor(groupId: string, userId: string): Promise<Viewer | null> {
  const m = await GroupMember.findOne({ groupId, userId }).lean(); return m ? { id: userId, role: m.role } : null;
}
export const membership = (groupId: string, userId: string) => GroupMember.findOne({ groupId, userId }).lean();
export const isMod = (m: any) => !!m && (m.admin === 'admin' || m.admin === 'coadmin');
export const isBlocked = async (a: string, b: string) => !!(await User.exists({ $or: [{ _id: a, blocked: b }, { _id: b, blocked: a }] }));
/** Who is this user in relation to this message? null = no access at all (group non-member / DM outsider). */
export async function accessFor(msg: any, userId: string): Promise<Viewer | null> {
  if (msg.groupId) return viewerFor(String(msg.groupId), userId);
  return String(msg.senderId) === userId || String(msg.toUserId) === userId ? { id: userId, role: '' } : null;
}
