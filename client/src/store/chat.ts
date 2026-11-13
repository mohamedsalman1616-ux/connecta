import { create } from 'zustand'; import { api } from '../lib/api'; import { ckey, Chat, Member, Msg, Notif } from '../lib/types';
interface S { chats: Chat[]; chatsLoaded: boolean; active: { type: 'group' | 'dm'; id: string } | null; msgs: Record<string, Msg[]>; members: Record<string, Member[]>; info: Record<string, any>;
  typing: Record<string, number>; notifs: Notif[]; unreadNotifs: number; presence: Record<string, boolean>; reply: Msg | null;
  loadChats: () => Promise<void>; setActive: (a: S['active']) => void; loadMsgs: (t: 'group' | 'dm', id: string) => Promise<void>; loadMembers: (gid: string) => Promise<void>; loadInfo: (gid: string) => Promise<void>;
  upsert: (m: Msg, me: string) => void; remove: (id: string) => void; patchReceipt: (r: any) => void; loadNotifs: () => Promise<void>; setReply: (m: Msg | null) => void; dropGroup: (gid: string) => void }
export const msgKey = (m: Msg, me: string) => m.groupId ? ckey('group', m.groupId) : ckey('dm', m.senderId === me ? m.toUserId! : m.senderId);
export const useChat = create<S>((set, get) => ({
  chats: [], chatsLoaded: false, active: null, msgs: {}, members: {}, info: {}, typing: {}, notifs: [], unreadNotifs: 0, presence: {}, reply: null,
  loadChats: async () => { const chats = await api<Chat[]>('/chats'); set({ chats, chatsLoaded: true }); },
  setActive: active => set({ active, reply: null }),
  loadMsgs: async (t, id) => { const list = await api<Msg[]>(t === 'group' ? `/groups/${id}/messages` : `/dm/${id}/messages`); set(s => ({ msgs: { ...s.msgs, [ckey(t, id)]: list } })); },
  loadMembers: async gid => { const m = await api<Member[]>(`/groups/${gid}/members`); set(s => ({ members: { ...s.members, [gid]: m } })); },
  loadInfo: async gid => { const i = await api(`/groups/${gid}`); set(s => ({ info: { ...s.info, [gid]: i } })); },
  upsert: (m, me) => set(s => { const k = msgKey(m, me), list = s.msgs[k]; if (!list) return {};
    const i = list.findIndex(x => x._id === m._id); return { msgs: { ...s.msgs, [k]: i >= 0 ? list.map((x, j) => j === i ? m : x) : [...list, m] } }; }),
  remove: id => set(s => ({ msgs: Object.fromEntries(Object.entries(s.msgs).map(([k, l]) => [k, l.filter(m => m._id !== id)])) })),
  patchReceipt: r => set(s => ({ msgs: Object.fromEntries(Object.entries(s.msgs).map(([k, l]) => [k, l.map(m => m._id !== r.messageId ? m : { ...m,
    deliveredTo: [...new Set([...(m.deliveredTo ?? []), ...(r.deliveredTo ?? [])])], readBy: [...new Set([...(m.readBy ?? []), ...(r.readBy ?? [])])] })])) })),
  loadNotifs: async () => { const r = await api('/notifications'); set({ notifs: r.items, unreadNotifs: r.unread }); },
  setReply: reply => set({ reply }),
  dropGroup: gid => set(s => ({ chats: s.chats.filter(c => !(c.type === 'group' && c.id === gid)), active: s.active?.id === gid ? null : s.active })),
}));
