import { Server } from 'socket.io'; import type { Server as H } from 'http';
import { authenticate } from './middleware/auth'; import { User, GroupMember } from './models';
import { viewerFor, isBlocked, OID } from './services/access.service';
export let io: Server;
export const room = (id: string) => `user:${id}`;
export function initSocket(http: H) {
  io = new Server(http, { cors: { origin: process.env.CLIENT_ORIGIN } });
  io.use(async (s, next) => { try { s.data.user = await authenticate(String(s.handshake.auth?.token)); next(); } catch { next(new Error('unauthorized')); } });
  io.on('connection', async s => {
    const me = s.data.user.id as string; s.join(room(me)); // no shared group rooms: every delivery is per-user and filtered
    await User.findByIdAndUpdate(me, { online: true }); io.emit('presence', { id: me, online: true });
    s.on('typing', async (p: { toUserId?: string; groupId?: string }) => {
      try {
        if (p?.groupId && OID.test(p.groupId)) {
          if (!(await viewerFor(p.groupId, me))) return;
          for (const m of await GroupMember.find({ groupId: p.groupId }).lean()) if (String(m.userId) !== me) io.to(room(String(m.userId))).emit('typing', { from: me, groupId: p.groupId });
        } else if (p?.toUserId && OID.test(p.toUserId) && !(await isBlocked(me, p.toUserId))) io.to(room(p.toUserId)).emit('typing', { from: me });
      } catch { /* ignore malformed typing events */ }
    });
    s.on('disconnect', async () => {
      if ((await io.in(room(me)).fetchSockets()).length) return; // other tab still open
      await User.findByIdAndUpdate(me, { online: false, lastSeen: new Date() }); io.emit('presence', { id: me, online: false, lastSeen: new Date() });
    });
  });
}
