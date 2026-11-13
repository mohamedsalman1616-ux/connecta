import { useState } from 'react';
import {
  Reply,
  SmilePlus,
  Copy,
  Forward,
  Star,
  Pencil,
  Pin,
  Trash2,
  Flag,
  Check,
  CheckCheck,
  Download,
  Lock,
  FileText,
  Eye,
  ShieldAlert,
  Clock,
  CameraOff,
  MoreVertical,
  Activity,
  History,
  Info,
} from 'lucide-react';
import { api, fileUrl } from '../lib/api';
import { fmtTime } from '../lib/hooks';
import type { Msg } from '../lib/types';
import { useAuth } from '../store/auth';
import { useChat } from '../store/chat';
import { useUI } from '../store/ui';
import { Protected } from './Protected';

const QUICK = ['👍', '❤️', '😂', '😮', '🙏', '🎉'];

function Badge({ msg, mine }: { msg: Msg; mine: boolean }) {
  const p = msg.perm ?? {};
  const items: { t: string; i: React.ReactNode }[] = [];

  if (p.viewMode === 'custom') {
    items.push({ t: mine ? 'Restricted audience' : 'Confidential', i: <ShieldAlert size={11} /> });
  }
  if (msg.can.screenshotProtected || msg.can.allowScreenshot === false) {
    items.push({ t: 'Screenshot Restricted', i: <CameraOff size={11} /> });
  }
  if (!mine && msg.can.restricted) {
    items.push({ t: 'View-only', i: <Eye size={11} /> });
  }
  if (!mine && msg.can.edit) {
    items.push({ t: 'Editor access', i: <Pencil size={11} /> });
  }
  if (p.expiresAt) {
    items.push({
      t: `Expires ${new Date(p.expiresAt).toLocaleString([], {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      i: <Clock size={11} />,
    });
  }

  return items.length ? (
    <div className="mb-1.5 flex flex-wrap gap-1">
      {items.map((x) => (
        <span
          key={x.t}
          className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
        >
          {x.i}
          {x.t}
        </span>
      ))}
    </div>
  ) : null;
}

function Attachment({ a, msg }: { a: Msg['attachments'][number]; msg: Msg }) {
  const src = fileUrl(a.href);
  const t = a.type ?? '';
  const block = (e: React.SyntheticEvent) => {
    if (!a.canDownload || msg.can.screenshotProtected) e.preventDefault();
  };

  if (t.startsWith('image/'))
    return (
      <img
        src={src}
        alt={a.name}
        draggable={false}
        onContextMenu={block}
        className={`mt-1.5 max-h-72 rounded-xl border border-border/50 object-cover ${
          a.canDownload && !msg.can.screenshotProtected ? '' : 'pointer-events-none'
        }`}
      />
    );
  if (t.startsWith('video/'))
    return (
      <video
        src={src}
        controls
        controlsList={a.canDownload && !msg.can.screenshotProtected ? undefined : 'nodownload noplaybackrate'}
        disablePictureInPicture
        onContextMenu={block}
        className="mt-1.5 max-h-72 rounded-xl border border-border/50"
      />
    );
  if (t.startsWith('audio/'))
    return (
      <audio
        src={src}
        controls
        controlsList={a.canDownload && !msg.can.screenshotProtected ? undefined : 'nodownload'}
        onContextMenu={block}
        className="mt-1.5 max-w-full"
      />
    );
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm backdrop-blur-sm">
      <FileText size={18} />
      <span className="flex-1 truncate">{a.name}</span>
      {a.canDownload && !msg.can.screenshotProtected ? (
        <a
          href={fileUrl(a.href + '?dl=1')}
          download
          aria-label={`Download ${a.name}`}
          className="rounded-full p-1 hover:bg-white/20 transition"
        >
          <Download size={16} />
        </a>
      ) : (
        <span title="Download locked" className="flex items-center gap-1 text-xs opacity-80">
          <Lock size={13} />
          Locked
        </span>
      )}
    </div>
  );
}

export function MessageBubble({
  msg,
  mine,
  name,
  showName,
  all,
}: {
  msg: Msg;
  mine: boolean;
  name: string;
  showName: boolean;
  all: Msg[];
}) {
  const me = useAuth((s) => s.user)!;
  const { setReply, upsert, loadChats, members } = useChat();
  const { toast, open } = useUI();
  const [bar, setBar] = useState(false);
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [del, setDel] = useState(false);

  const can = msg.can;
  const group = !!msg.groupId;
  const parent = msg.replyTo ? all.find((m) => m._id === msg.replyTo) : undefined;

  const deny = (what: string) =>
    toast(`You don't have permission to ${what} this protected message.`, 'warn');
  const run = async (fn: () => Promise<any>) => {
    try {
      await fn();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const other = !group ? (mine ? msg.toUserId! : msg.senderId) : '';
  const read = group
    ? (msg.readBy?.length ?? 0) > 0
    : (msg.readBy ?? []).includes(other);
  const delivered = group
    ? (msg.deliveredTo?.length ?? 0) > 0
    : (msg.deliveredTo ?? []).includes(other);

  const groups = Object.entries(
    msg.reactions.reduce<Record<string, string[]>>(
      (a, r) => ({ ...a, [r.emoji]: [...(a[r.emoji] ?? []), r.userId] }),
      {}
    )
  );

  const act = (ok: boolean, what: string, fn: () => void) => () =>
    ok ? fn() : deny(what);

  const B = ({
    ok,
    icon,
    label,
    onClick,
  }: {
    ok: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }) => (
    <button
      aria-label={label}
      title={ok ? label : `${label} (restricted)`}
      onClick={onClick}
      className={`rounded-full p-1.5 hover:bg-surface-hover hover:text-ink transition ${
        ok ? 'text-muted' : 'opacity-35 cursor-not-allowed'
      }`}
    >
      {icon}
    </button>
  );

  const who = (id: string) =>
    members[msg.groupId ?? '']?.find((m) => m.userId === id)?.displayName ?? '';

  return (
    <div className={`group flex ${mine ? 'justify-end' : 'justify-start'} px-3 py-1`}>
      <div className="relative max-w-[88%] sm:max-w-[70%]">
        {/* Floating Quick Action Bar */}
        <div
          className={`absolute -top-6 z-10 ${
            mine ? 'right-0' : 'left-0'
          } ${bar ? 'flex' : 'hidden group-hover:flex'} glass items-center rounded-full bg-surface/95 px-1.5 py-0.5 shadow-premium border border-border/80`}
        >
          <B
            ok={can.reply}
            icon={<Reply size={15} />}
            label="Reply"
            onClick={act(can.reply, 'reply to', () => setReply(msg))}
          />
          <B
            ok={can.react}
            icon={<SmilePlus size={15} />}
            label="React"
            onClick={act(can.react, 'react to', () => setPicker(!picker))}
          />
          <B
            ok={can.copy && !can.screenshotProtected}
            icon={<Copy size={15} />}
            label="Copy text"
            onClick={act(
              can.copy && !can.screenshotProtected,
              'copy',
              () =>
                navigator.clipboard
                  .writeText(msg.content)
                  .then(() => {
                    toast('Copied to clipboard', 'success');
                    api(`/messages/${msg._id}/copy`, { method: 'POST', body: {} }).catch(() => {});
                  })
            )}
          />
          <B
            ok={can.forward}
            icon={<Forward size={15} />}
            label="Forward"
            onClick={act(can.forward, 'forward', () => open({ k: 'forward', msg }))}
          />
          <B
            ok
            icon={
              <Star
                size={15}
                className={msg.starred ? 'fill-amber-500 text-amber-500' : ''}
              />
            }
            label="Star"
            onClick={() =>
              run(async () => {
                const r = await api(`/messages/${msg._id}/star`, {
                  method: 'POST',
                  body: {},
                });
                upsert({ ...msg, starred: r.starred }, me.id);
              })
            }
          />
          <B
            ok={can.edit}
            icon={<Pencil size={15} />}
            label="Edit"
            onClick={act(can.edit, 'edit', () => setEdit(msg.content))}
          />
          {group && (
            <B
              ok
              icon={<Pin size={15} className={msg.pinned ? 'text-accent' : ''} />}
              label="Pin"
              onClick={() =>
                run(() => api(`/messages/${msg._id}/pin`, { method: 'POST', body: {} }))
              }
            />
          )}
          {mine ? (
            <>
              <B
                ok
                icon={
                  <Trash2 size={15} className={del ? 'text-rose-500' : ''} />
                }
                label={del ? 'Click again to delete' : 'Delete'}
                onClick={() =>
                  del
                    ? run(() =>
                        api(`/messages/${msg._id}`, { method: 'DELETE' }).then(
                          loadChats
                        )
                      )
                    : (setDel(true), setTimeout(() => setDel(false), 3000))
                }
              />
              <B
                ok
                icon={<MoreVertical size={15} />}
                label="Message Activity & Info"
                onClick={() => setMenu(!menu)}
              />
            </>
          ) : (
            <B
              ok
              icon={<Flag size={15} />}
              label="Report"
              onClick={() => open({ k: 'report', type: 'message', id: msg._id })}
            />
          )}
        </div>

        {/* Sender-only Three-Dot Menu for Message Activity */}
        {mine && menu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass absolute right-0 top-2 z-30 w-48 rounded-2xl bg-surface/98 p-1.5 shadow-premium-lg border border-border text-xs text-ink"
          >
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
              Message Activity
            </p>
            {(
              [
                { tab: 'ALL', label: 'Message Info', icon: <Info size={13} /> },
                { tab: 'VIEW', label: 'View Activity', icon: <Eye size={13} /> },
                { tab: 'EDIT', label: 'Edit History', icon: <History size={13} /> },
                { tab: 'FORWARD', label: 'Forward History', icon: <Forward size={13} /> },
                { tab: 'PERMS', label: 'Permission Details', icon: <Activity size={13} /> },
              ] as const
            ).map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setMenu(false);
                  setBar(false);
                  open({ k: 'activity', msg, tab: item.tab });
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left hover:bg-surface-hover transition"
              >
                <span className="text-accent">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji quick reaction picker */}
        {picker && (
          <div
            className={`glass absolute -top-14 z-20 flex gap-1 rounded-full bg-surface/95 p-1.5 shadow-premium border border-border/80 ${
              mine ? 'right-0' : 'left-0'
            }`}
          >
            {QUICK.map((e) => (
              <button
                key={e}
                className="rounded-full px-1 text-xl hover:scale-125 transition-transform"
                onClick={() => {
                  setPicker(false);
                  run(() => api(`/messages/${msg._id}/react`, { body: { emoji: e } }));
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Chat Bubble Body */}
        <div
          onClick={() => setBar(!bar)}
          className={`rounded-2xl px-3.5 py-2.5 transition-shadow ${
            mine
              ? 'bubble-me rounded-br-sm'
              : 'bubble-other rounded-bl-sm text-ink'
          }`}
        >
          {showName && !mine && (
            <p className="mb-1 text-xs font-bold text-accent tracking-wide">{name}</p>
          )}

          <Badge msg={msg} mine={mine} />

          {msg.forwarded && (
            <p className="mb-1 flex items-center gap-1 text-xs italic opacity-80">
              <Forward size={11} />
              Forwarded
            </p>
          )}

          {msg.replyTo && (
            <div className="mb-1.5 rounded-lg border-l-4 border-accent bg-black/15 px-2.5 py-1 text-xs opacity-90">
              {parent ? parent.content.slice(0, 70) || 'Attachment' : 'Original message'}
            </div>
          )}

          <Protected msg={msg}>
            {edit !== null ? (
              <div onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="field !bg-black/25 text-sm text-white"
                  rows={2}
                  value={edit}
                  onChange={(e) => setEdit(e.target.value)}
                  autoFocus
                />
                <div className="mt-1.5 flex justify-end gap-2 text-xs">
                  <button
                    onClick={() => setEdit(null)}
                    className="rounded-full bg-black/25 px-3 py-1 text-white hover:bg-black/40 transition"
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-grad rounded-full px-3.5 py-1 font-semibold text-white shadow-sm"
                    onClick={() =>
                      run(async () => {
                        await api(`/messages/${msg._id}`, {
                          method: 'PATCH',
                          body: { content: edit },
                        });
                        setEdit(null);
                      })
                    }
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {msg.content.trim() && (
                  <p className="whitespace-pre-wrap break-words text-[0.93rem] leading-relaxed">
                    {msg.content}
                  </p>
                )}
                {msg.attachments.map((a, i) => (
                  <Attachment key={i} a={a} msg={msg} />
                ))}
              </>
            )}
          </Protected>

          {/* Time & Delivery receipts */}
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-80">
            {msg.pinned && <Pin size={10} />}
            {msg.starred && <Star size={10} className="fill-current text-amber-300" />}
            {msg.edited && <span>edited</span>}
            <span>{fmtTime(msg.createdAt)}</span>
            {mine &&
              (read ? (
                <span title="Read"><CheckCheck size={14} className="text-[#E9E2FA]" /></span>
              ) : delivered ? (
                <span title="Delivered"><CheckCheck size={14} /></span>
              ) : (
                <span title="Sent"><Check size={14} /></span>
              ))}
          </div>
        </div>

        {/* Reaction badges */}
        {groups.length > 0 && (
          <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
            {groups.map(([e, u]) => (
              <button
                key={e}
                title={u.map(who).filter(Boolean).join(', ')}
                onClick={() =>
                  can.react &&
                  run(() => api(`/messages/${msg._id}/react`, { body: { emoji: e } }))
                }
                className={`glass rounded-full px-2 py-0.5 text-xs shadow-sm transition hover:scale-105 ${
                  u.includes(me.id) ? 'border-accent bg-accent/20' : ''
                }`}
              >
                {e} <span className="font-semibold text-[10px]">{u.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
