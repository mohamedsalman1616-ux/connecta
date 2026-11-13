import { useState } from 'react';
import { Bell, Users, UserPlus, Search, MessagesSquare, Plus, Sun, Moon, Shield } from 'lucide-react';
import { avatarUrl, groupPhotoUrl } from '../lib/api';
import { fmtTime, useNow } from '../lib/hooks';
import { ckey } from '../lib/types';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Avatar } from './Avatar';
import { Empty } from './Modal';
import { StoriesBar } from './Stories';
import { applyTheme, getPersistedTheme } from '../lib/themes';

export default function ChatList() {
  const { chats, chatsLoaded, active, setActive, typing, presence, unreadNotifs } = useChat();
  const me = useAuth((s) => s.user)!;
  const { saveSettings } = useAuth();
  const { open, setPanel } = useUI();
  const [q, setQ] = useState('');
  const now = useNow(1500);

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(getPersistedTheme());

  const toggleTheme = () => {
    const next: 'light' | 'dark' = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(next);
    applyTheme(next, undefined, me.settings?.fontSize);
    saveSettings({ theme: next }).catch(() => {});
  };

  const list = chats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const isManager = me.role === 'Manager';

  return (
    <aside
      className={`sidebar-royal text-white flex w-full flex-col border-y-0 border-l-0 md:w-[22.5rem] md:max-w-[34vw] ${
        active ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-3.5">
        <button
          aria-label="Open settings and profile"
          onClick={() => open({ k: 'settings' })}
          className="relative transition-transform hover:scale-105"
        >
          <Avatar name={me.displayName || me.username} src={avatarUrl(me.id)} size={42} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="display text-base font-bold leading-tight text-white">Connecta</h1>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-[#E9E2FA]">
              {me.role}
            </span>
          </div>
          <p className="truncate text-xs text-[#E9E2FA]/80 mt-0.5">
            {me.displayName || me.username}
          </p>
        </div>

        {/* Real-time Theme Switcher: Light and Dark */}
        <button
          aria-label={currentTheme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          title={currentTheme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          className="rounded-full p-2 text-[#E9E2FA]/85 hover:bg-white/15 hover:text-white transition"
          onClick={toggleTheme}
        >
          {currentTheme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-[#A78BFA]" />}
        </button>

        {/* Role Manager Icon (for Managers) */}
        {isManager && (
          <button
            aria-label="Manage Roles"
            title="Custom Role Management"
            className="rounded-full p-2 text-[#E9E2FA] hover:bg-white/15 hover:text-white transition"
            onClick={() => open({ k: 'roles' })}
          >
            <Shield size={18} />
          </button>
        )}

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="relative rounded-full p-2 text-[#E9E2FA]/85 hover:bg-white/15 hover:text-white transition"
          onClick={() => open({ k: 'notifs' })}
        >
          <Bell size={18} />
          {unreadNotifs > 0 && (
            <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#A78BFA] px-1 text-[10px] font-bold text-[#1E1733] shadow-sm">
              {unreadNotifs}
            </span>
          )}
        </button>

        {/* Find People */}
        <button
          aria-label="Find people"
          className="rounded-full p-2 text-[#E9E2FA]/85 hover:bg-white/15 hover:text-white transition"
          onClick={() => open({ k: 'people' })}
        >
          <UserPlus size={18} />
        </button>

        {/* New Group */}
        <button
          aria-label="New group"
          className="rounded-full bg-[#A78BFA] hover:bg-[#b8a1fb] p-2 text-[#1E1733] shadow-sm transition"
          onClick={() => open({ k: 'newgroup' })}
        >
          <Plus size={18} />
        </button>
      </div>

      <StoriesBar />

      {/* Search Input */}
      <div className="px-3.5 pb-2.5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-[#E9E2FA]/70" />
          <input
            className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-[#E9E2FA]/65 outline-none focus:border-[#A78BFA] focus:bg-white/15 transition"
            placeholder="Search conversations..."
            aria-label="Search chats"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {!chatsLoaded &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="m-2 flex animate-pulse items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-white/15" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 rounded bg-white/15" />
                <div className="h-3 w-3/4 rounded bg-white/10" />
              </div>
            </div>
          ))}

        {chatsLoaded && !list.length && (
          <Empty
            icon={<MessagesSquare size={32} className="text-[#E9E2FA]/80" />}
            title={q ? 'No matching chats' : 'No conversations yet'}
            hint={
              q
                ? undefined
                : 'Start a direct message or create a group to begin chatting.'
            }
          />
        )}

        {list.map((c) => {
          const k = ckey(c.type, c.id);
          const isA = active?.type === c.type && active.id === c.id;
          const typ = (typing[k] ?? 0) > now - 3000;

          return (
            <button
              key={k}
              onClick={() => {
                setActive({ type: c.type, id: c.id });
                setPanel(false);
              }}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150 ${
                isA
                  ? 'bg-white/18 border border-[#A78BFA]/45 shadow-sm'
                  : 'hover:bg-white/10 border border-transparent'
              }`}
            >
              <Avatar
                name={c.name}
                size={46}
                online={c.type === 'dm' ? presence[c.id] ?? c.online : undefined}
                src={
                  c.hasPhoto
                    ? c.type === 'group'
                      ? groupPhotoUrl(c.id)
                      : avatarUrl(c.id)
                    : undefined
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-white text-sm">
                    {c.type === 'group' && <Users size={13} className="shrink-0 text-[#E9E2FA]/80" />}
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[#E9E2FA]/70">
                    {c.last ? fmtTime(c.last.createdAt) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p
                    className={`truncate text-xs ${
                      typ ? 'text-[#A78BFA] font-medium italic' : 'text-[#E9E2FA]/75'
                    }`}
                  >
                    {typ
                      ? 'typing…'
                      : c.last
                      ? `${c.last.senderId === me.id ? 'You: ' : ''}${
                          c.last.content || (c.last.hasFile ? '📎 Attachment' : '')
                        }`
                      : 'No messages yet'}
                  </p>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#A78BFA] px-1.5 text-[11px] font-bold text-[#1E1733]">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
