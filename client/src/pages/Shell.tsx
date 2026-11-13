import { useEffect } from 'react'; import { api } from '../lib/api'; import { connectSocket } from '../lib/socket'; import { beep, useProtectionGuards } from '../lib/hooks'; import { ckey, Msg } from '../lib/types';
import { useAuth } from '../store/auth'; import { msgKey, useChat } from '../store/chat'; import { useUI } from '../store/ui';
import ChatList from '../components/ChatList'; import ChatWindow from '../components/ChatWindow'; import Dashboard from './Dashboard'; import { ModalHost } from '../components/Modals'; import { Toasts } from '../components/Modal';
function useRealtime() {
  const me = useAuth(s => s.user)!; const logout = useAuth(s => s.logout);
  useEffect(() => {
    const s = connectSocket(), C = () => useChat.getState(), toast = useUI.getState().toast;
    const sync = () => { C().loadChats().catch(() => {}); C().loadNotifs().catch(() => {}); const a = C().active; if (a) C().loadMsgs(a.type, a.id).catch(() => {}); };
    s.on('connect', sync);
    s.on('connect_error', e => { if (e.message === 'unauthorized') logout().then(() => (location.href = '/login')); });
    s.on('message:new', (m: Msg) => { C().upsert(m, me.id); C().loadChats(); }); s.on('message:updated', (m: Msg) => { C().upsert(m, me.id); C().loadChats(); });
    s.on('message:deleted', (d: { id: string }) => { C().remove(d.id); C().loadChats(); }); s.on('receipt', (r: any) => C().patchReceipt(r));
    s.on('presence', (p: any) => { useChat.setState(st => ({ presence: { ...st.presence, [p.id]: p.online }, chats: st.chats.map(c => c.type === 'dm' && c.id === p.id ? { ...c, online: p.online, lastSeen: p.lastSeen ?? c.lastSeen } : c) })); });
    s.on('typing', (t: any) => useChat.setState(st => ({ typing: { ...st.typing, [t.groupId ? ckey('group', t.groupId) : ckey('dm', t.from)]: Date.now() } })));
    s.on('notification', (n: any) => { const st = me.settings ?? useAuth.getState().user?.settings ?? {}, np = st.notifications ?? {}, a = C().active, here = a && n.data && (n.data.groupId ? a.id === n.data.groupId : a.id === n.data.fromUserId) && !document.hidden;
      useChat.setState(x => ({ notifs: [{ ...n, createdAt: n.createdAt }, ...x.notifs], unreadNotifs: x.unreadNotifs + 1 })); if (here) return;
      const allowed = n.data?.groupId ? np.groups !== false : np.messages !== false; if (!allowed) return; toast(n.text, 'info'); if (st.sound !== false) beep(st.soundVolume ?? 0.5); });
    s.on('group:added', (g: any) => { C().loadChats(); toast(`You were added to ${g.name}`, 'success'); });
    s.on('group:removed', (g: any) => { C().dropGroup(g.groupId); C().loadChats(); toast('You no longer have access to a group', 'warn'); });
    s.on('activity:new', (d: any) => { window.dispatchEvent(new CustomEvent('connecta:activity', { detail: d })); });
    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [me.id]);
}
export default function Shell() {
  const active = useChat(s => s.active); useRealtime(); useProtectionGuards();
  useEffect(() => { api('/users/me').then(u => useAuth.getState().setUser({ ...useAuth.getState().user!, ...u })).catch(() => {}); }, []);
  return (<div className="flex h-full"><ChatList />{active ? <main className="flex min-w-0 flex-1"><ChatWindow /></main> : <Dashboard />}<ModalHost /><Toasts /></div>);
}
export { msgKey };
