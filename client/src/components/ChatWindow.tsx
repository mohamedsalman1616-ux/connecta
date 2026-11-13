import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Search,
  PanelRight,
  Palette,
  X,
  Pin,
  MessageSquareDashed,
  ShieldAlert,
  CameraOff,
} from 'lucide-react';
import { api, avatarUrl, groupPhotoUrl } from '../lib/api';
import { ckey, Msg } from '../lib/types';
import { WALLPAPERS } from '../lib/themes';
import { ago, fmtDay, useNow } from '../lib/hooks';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Avatar } from './Avatar';
import { Spinner, Empty } from './Modal';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { SidePanel } from './SidePanel';

export default function ChatWindow() {
  const {
    active,
    chats,
    msgs,
    members,
    info,
    typing,
    presence,
    loadMsgs,
    loadMembers,
    loadInfo,
    setActive,
    upsert,
    loadChats,
  } = useChat();
  const me = useAuth((s) => s.user)!;
  const saveSettings = useAuth((s) => s.saveSettings);
  const { panel, setPanel, toast } = useUI();

  const a = active!;
  const key = ckey(a.type, a.id);
  const chat = chats.find((c) => c.type === a.type && c.id === a.id);

  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Msg[] | null>(null);
  const [wp, setWp] = useState(false);

  const end = useRef<HTMLDivElement>(null);
  const now = useNow(1500);
  const list = msgs[key] ?? [];

  useEffect(() => {
    setStatus('loading');
    setQ('');
    setSearching(false);
    setFound(null);
    setWp(false);

    Promise.all([
      loadMsgs(a.type, a.id),
      ...(a.type === 'group' ? [loadMembers(a.id), loadInfo(a.id)] : []),
    ])
      .then(() => setStatus('ok'))
      .catch((e) => {
        setStatus('error');
        toast(e.message, 'error');
      });
  }, [key]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length, found, status]);

  // Read receipts tracking
  useEffect(() => {
    const ids = list
      .filter((m) => m.senderId !== me.id && !(m.readBy ?? []).includes(me.id))
      .map((m) => m._id);
    if (!ids.length || document.hidden) return;

    api('/messages/read', { body: { ids } })
      .then(() => {
        ids.forEach((id) => {
          const m = list.find((x) => x._id === id)!;
          upsert({ ...m, readBy: [...(m.readBy ?? []), me.id] }, me.id);
        });
        loadChats();
      })
      .catch(() => {});
  }, [list.length, key]);

  // Message search
  useEffect(() => {
    if (!searching || !q.trim()) {
      setFound(null);
      return;
    }
    const t = setTimeout(
      () =>
        api<Msg[]>(
          a.type === 'group'
            ? `/groups/${a.id}/messages?q=${encodeURIComponent(q)}`
            : `/dm/${a.id}/messages?q=${encodeURIComponent(q)}`
        )
          .then(setFound)
          .catch((e) => toast(e.message, 'error')),
      300
    );
    return () => clearTimeout(t);
  }, [q, searching]);

  const gi = a.type === 'group' ? info[a.id] : null;
  const isMod = gi?.me?.admin && gi.me.admin !== 'none';
  const locked =
    gi?.announcementsOnly && !isMod
      ? 'Announcements mode: Only administrators can post in this group.'
      : undefined;

  const typingNow = (typing[key] ?? 0) > now - 3000;
  const online = a.type === 'dm' ? presence[a.id] ?? chat?.online : undefined;

  const sub = typingNow
    ? 'typing…'
    : a.type === 'group'
    ? `${gi?.memberCount ?? members[a.id]?.length ?? ''} members`
    : online
    ? 'online'
    : `last seen ${ago(
        presence[a.id] === false ? new Date().toISOString() : chat?.lastSeen
      )}`;

  const names = useMemo(
    () =>
      Object.fromEntries(
        (members[a.id] ?? []).map((m) => [m.userId, m.displayName || m.username])
      ),
    [members, a.id]
  );

  const shown = found ?? list;
  const pinned = list.filter((m) => m.pinned).slice(-1)[0];
  const hasScreenshotRestrictedMsg = list.some(
    (m) => m.can?.screenshotProtected || m.can?.allowScreenshot === false
  );

  const css = WALLPAPERS.find(
    (w) => w.id === (me.settings?.chatWallpapers?.[key] ?? me.settings?.wallpaper ?? 'none')
  )?.css;

  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Chat Window Header */}
        <header className="glass flex items-center gap-3 border-x-0 border-t-0 px-4 py-2.5 shadow-sm">
          <button
            className="rounded-full p-2 text-muted hover:bg-surface-hover hover:text-ink md:hidden transition"
            aria-label="Back"
            onClick={() => setActive(null)}
          >
            <ArrowLeft size={20} />
          </button>

          <button
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => setPanel(!panel)}
          >
            <Avatar
              name={chat?.name ?? ''}
              size={42}
              online={online}
              src={
                chat?.hasPhoto
                  ? a.type === 'group'
                    ? groupPhotoUrl(a.id)
                    : avatarUrl(a.id)
                  : undefined
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-bold leading-tight text-ink text-sm sm:text-base">
                  {chat?.name ?? '…'}
                </h2>
                {hasScreenshotRestrictedMsg && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent"
                    title="This conversation contains screenshot-restricted content"
                  >
                    <CameraOff size={11} />
                    Protected
                  </span>
                )}
              </div>
              <p
                className={`truncate text-xs ${
                  typingNow ? 'text-accent font-medium' : 'text-muted'
                }`}
              >
                {sub}
              </p>
            </div>
          </button>

          {searching ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                className="field !w-44 !py-1.5 text-xs sm:!w-60"
                placeholder="Search messages..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                aria-label="Close search"
                onClick={() => {
                  setSearching(false);
                  setQ('');
                }}
                className="rounded-full p-2 text-muted hover:bg-surface-hover hover:text-ink transition"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <>
              <button
                aria-label="Search messages"
                className="rounded-full p-2 text-muted hover:bg-surface-hover hover:text-ink transition"
                onClick={() => setSearching(true)}
              >
                <Search size={18} />
              </button>

              <div className="relative">
                <button
                  aria-label="Chat wallpaper"
                  className="rounded-full p-2 text-muted hover:bg-surface-hover hover:text-ink transition"
                  onClick={() => setWp(!wp)}
                >
                  <Palette size={18} />
                </button>
                {wp && (
                  <div className="glass absolute right-0 z-30 mt-2 w-44 rounded-2xl bg-surface/98 p-1.5 shadow-premium-lg border border-border">
                    <p className="px-3 py-1 text-[11px] font-bold text-accent uppercase tracking-wider">
                      Wallpaper
                    </p>
                    {WALLPAPERS.map((w) => (
                      <button
                        key={w.id}
                        className="block w-full rounded-xl px-3 py-1.5 text-left text-xs text-ink hover:bg-surface-hover transition"
                        onClick={() => {
                          setWp(false);
                          saveSettings({
                            chatWallpapers: {
                              ...(me.settings?.chatWallpapers ?? {}),
                              [key]: w.id,
                            },
                          }).catch((e) => toast(e.message, 'error'));
                        }}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                aria-label="Chat info"
                className="rounded-full p-2 text-muted hover:bg-surface-hover hover:text-ink transition"
                onClick={() => setPanel(!panel)}
              >
                <PanelRight size={18} />
              </button>
            </>
          )}
        </header>

        {/* Pinned banner */}
        {pinned && !found && (
          <div className="glass flex items-center gap-2 border-x-0 border-t-0 px-4 py-1.5 text-xs bg-accent/5 border-b border-border/60">
            <Pin size={13} className="text-accent shrink-0" />
            <span className="truncate text-muted">
              Pinned:{' '}
              <span className="text-ink font-medium">
                {pinned.content.slice(0, 90) || 'Pinned attachment'}
              </span>
            </span>
          </div>
        )}

        {/* Message Feed Container */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1" style={{ background: css }}>
          {status === 'loading' && <Spinner />}
          {status === 'error' && (
            <Empty
              icon={<ShieldAlert size={32} />}
              title="Couldn't load messages"
              hint="You may no longer have permissions for this chat, or the server is unreachable."
            />
          )}
          {status === 'ok' && !shown.length && (
            <Empty
              icon={<MessageSquareDashed size={34} />}
              title={found ? 'No matching messages' : 'No messages yet'}
              hint={
                found
                  ? 'Only messages you have permission to view are searched.'
                  : 'Send a message to start this luxury conversation.'
              }
            />
          )}
          {status === 'ok' &&
            shown.map((m, i) => (
              <div key={m._id}>
                {(i === 0 ||
                  fmtDay(shown[i - 1].createdAt) !== fmtDay(m.createdAt)) && (
                  <p className="my-3 text-center">
                    <span className="glass rounded-full px-3 py-1 text-[11px] font-medium text-muted shadow-sm">
                      {fmtDay(m.createdAt)}
                    </span>
                  </p>
                )}
                <MessageBubble
                  msg={m}
                  mine={m.senderId === me.id}
                  name={names[m.senderId] ?? 'Member'}
                  showName={
                    a.type === 'group' &&
                    (i === 0 || shown[i - 1].senderId !== m.senderId)
                  }
                  all={list}
                />
              </div>
            ))}
          <div ref={end} />
        </div>

        {/* Message Composer */}
        <Composer type={a.type} id={a.id} locked={locked} />
      </section>

      {/* Side Panel for Group/Profile Info */}
      {panel && <SidePanel />}
    </div>
  );
}
