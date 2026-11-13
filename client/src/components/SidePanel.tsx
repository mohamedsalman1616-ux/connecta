import { useEffect, useState } from 'react';
import {
  X,
  Link2,
  Crown,
  Shield,
  UserMinus,
  LogOut,
  Trash2,
  Ban,
  Flag,
  UserPlus,
  Image as Img,
  Pin,
  Users as UsersI,
  Info,
  Copy,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { api, avatarUrl, fileUrl, groupPhotoUrl } from '../lib/api';
import type { Member, CustomRole } from '../lib/types';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Avatar } from './Avatar';
import { Toggle, Spinner, Empty } from './Modal';

export function SidePanel() {
  const { active } = useChat();
  const { setPanel } = useUI();
  return (
    <aside className="glass absolute inset-0 z-30 flex flex-col overflow-y-auto border-y-0 border-r-0 md:static md:inset-auto md:w-80 shadow-premium">
      <div className="flex items-center justify-between border-b border-border/70 px-4 pt-3.5 pb-2.5">
        <h2 className="font-bold text-sm text-ink">
          {active?.type === 'group' ? 'Group Details' : 'Contact Information'}
        </h2>
        <button
          aria-label="Close panel"
          onClick={() => setPanel(false)}
          className="rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-ink transition"
        >
          <X size={17} />
        </button>
      </div>
      {active?.type === 'group' ? <GroupPanel id={active.id} /> : <ProfilePanel id={active!.id} />}
    </aside>
  );
}

function ProfilePanel({ id }: { id: string }) {
  const [u, setU] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);
  const { toast, open } = useUI();
  const { setActive, loadChats } = useChat();

  useEffect(() => {
    api(`/users/${id}`)
      .then(setU)
      .catch((e) => toast(e.message, 'error'));
    api('/users/blocked')
      .then((b: any[]) => setBlocked(b.some((x) => x.id === id)))
      .catch(() => {});
  }, [id]);

  const run = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn();
      toast(ok, 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (!u) return <Spinner />;

  return (
    <div className="space-y-4 p-5 text-center">
      <div className="grid place-items-center">
        <Avatar
          name={u.displayName || u.username}
          size={90}
          src={u.hasAvatar ? avatarUrl(id) : undefined}
        />
      </div>
      <div>
        <h3 className="text-lg font-bold text-ink">{u.displayName || u.username}</h3>
        <p className="text-xs text-muted mt-0.5">
          @{u.username} · <span className="text-accent font-semibold">{u.role}</span>
        </p>
      </div>
      <p className="rounded-2xl border border-border bg-surface-hover/40 p-3 text-xs text-ink/90 leading-relaxed">
        {u.bio || 'No biography written yet.'}
      </p>
      <p className="text-xs italic text-muted">"{u.status}"</p>
      <div className="space-y-1.5 text-left pt-2 border-t border-border/60">
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface-hover transition"
          onClick={() => run(() => api('/contacts', { body: { username: u.username } }), 'Added to contacts')}
        >
          <UserPlus size={16} className="text-accent" />
          Add to contacts
        </button>
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-surface-hover transition"
          onClick={() =>
            run(async () => {
              await api(`/users/${id}/block`, {
                method: blocked ? 'DELETE' : 'POST',
                body: blocked ? undefined : {},
              });
              setBlocked(!blocked);
              loadChats();
            }, blocked ? 'User unblocked' : 'User blocked')
          }
        >
          <Ban size={16} className="text-muted" />
          {blocked ? 'Unblock member' : 'Block member'}
        </button>
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition"
          onClick={() => open({ k: 'report', type: 'user', id })}
        >
          <Flag size={16} />
          Report member to Manager
        </button>
      </div>
      <button
        className="text-xs text-muted hover:text-accent transition underline pt-2 block mx-auto"
        onClick={() => setActive(null)}
      >
        Close conversation
      </button>
    </div>
  );
}

function GroupPanel({ id }: { id: string }) {
  const { members, info, loadMembers, loadInfo, loadChats, setActive, dropGroup } = useChat();
  const me = useAuth((s) => s.user)!;
  const { toast, setPanel } = useUI();
  const [tab, setTab] = useState<'info' | 'members' | 'media' | 'pinned'>('info');
  const [media, setMedia] = useState<any[] | null>(null);
  const [pins, setPins] = useState<any[] | null>(null);

  const [add, setAdd] = useState('');
  const [addRole, setAddRole] = useState('Staff');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const [allRoles, setAllRoles] = useState<string[]>([
    'Manager',
    'General Manager',
    'Team Leader',
    'Staff',
  ]);

  const g = info[id];
  const list = members[id] ?? [];
  const mine = g?.me;
  const mod = mine?.admin && mine.admin !== 'none';
  const owner = mine?.admin === 'admin';

  useEffect(() => {
    setTab('info');
    setMedia(null);
    setPins(null);
    loadInfo(id);
    loadMembers(id);

    api<CustomRole[]>('/roles')
      .then((r) => {
        const names = r.map((x) => x.name);
        setAllRoles((prev) => [...new Set([...prev, ...names])]);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (g) {
      setName(g.name);
      setDesc(g.description ?? '');
    }
  }, [g?.name, g?.description]);

  useEffect(() => {
    if (tab === 'media')
      api(`/groups/${id}/media`)
        .then(setMedia)
        .catch((e) => toast(e.message, 'error'));
    if (tab === 'pinned')
      api(`/groups/${id}/pinned`)
        .then(setPins)
        .catch((e) => toast(e.message, 'error'));
  }, [tab]);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    try {
      await fn();
      ok && toast(ok, 'success');
      await Promise.all([loadMembers(id), loadInfo(id), loadChats()]);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (!g) return <Spinner />;

  const Tab = ({ t, i, l }: { t: typeof tab; i: React.ReactNode; l: string }) => (
    <button
      aria-label={l}
      title={l}
      onClick={() => setTab(t)}
      className={`flex-1 rounded-xl p-2 transition ${
        tab === t ? 'btn-grad text-white' : 'hover:bg-surface-hover text-muted hover:text-ink'
      }`}
    >
      <span className="grid place-items-center">{i}</span>
    </button>
  );

  const link = `${location.origin}/join/${g.inviteCode}`;

  return (
    <div className="p-4 space-y-4">
      <div className="grid place-items-center gap-1.5 text-center">
        <Avatar name={g.name} size={76} src={g.hasPhoto ? groupPhotoUrl(id) : undefined} />
        <h3 className="text-base font-bold text-ink">{g.name}</h3>
        <p className="text-xs text-muted">
          {g.memberCount} members · your role:{' '}
          <span className="text-accent font-semibold">{mine?.role}</span> (
          {mine?.admin === 'admin'
            ? 'owner'
            : mine?.admin === 'coadmin'
            ? 'co-admin'
            : 'member'}
          )
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-surface-hover/50 p-1 border border-border/80">
        <Tab t="info" i={<Info size={16} />} l="Info" />
        <Tab t="members" i={<UsersI size={16} />} l="Members" />
        <Tab t="media" i={<Img size={16} />} l="Media" />
        <Tab t="pinned" i={<Pin size={16} />} l="Pinned" />
      </div>

      {tab === 'info' && (
        <div className="space-y-3">
          {mod ? (
            <>
              <input
                className="field !text-xs"
                aria-label="Group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className="field !text-xs"
                rows={3}
                aria-label="Group description"
                placeholder="Description"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <button
                className="btn-grad w-full rounded-xl py-2 text-xs font-semibold"
                onClick={() =>
                  run(
                    () => api(`/groups/${id}`, { method: 'PATCH', body: { name, description: desc } }),
                    'Group updated'
                  )
                }
              >
                Save Details
              </button>
              <div className="rounded-xl border border-border bg-surface-hover/30 p-1">
                <Toggle
                  on={!!g.announcementsOnly}
                  onChange={(v) =>
                    run(() => api(`/groups/${id}`, { method: 'PATCH', body: { announcementsOnly: v } }))
                  }
                  label="Announcements only (admins can post)"
                />
              </div>
              <div className="rounded-2xl border border-border bg-surface-hover/40 p-3 text-xs space-y-1.5">
                <p className="flex items-center gap-1.5 font-semibold text-accent">
                  <Link2 size={14} />
                  Invite Link
                </p>
                <p className="break-all text-[11px] text-muted">{link}</p>
                <p className="text-[11px] text-muted">
                  Code: <b className="text-ink">{g.inviteCode}</b>
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-hover transition"
                    onClick={() =>
                      navigator.clipboard.writeText(g.inviteCode).then(() => toast('Invite code copied', 'success'))
                    }
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                  <button
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-hover transition"
                    onClick={() =>
                      run(
                        () => api(`/groups/${id}/invite/reset`, { method: 'POST', body: {} }),
                        'New invite code generated'
                      )
                    }
                  >
                    <RefreshCw size={12} />
                    Reset
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="rounded-xl border border-border bg-surface-hover/30 p-3 text-xs text-ink/90">
                {g.description || 'No description provided.'}
              </p>
              {g.announcementsOnly && (
                <p className="text-xs text-muted italic">Only administrators can post in this group.</p>
              )}
            </>
          )}

          <button
            className="flex w-full items-center gap-2.5 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition"
            onClick={() =>
              run(async () => {
                await api(`/groups/${id}/members/${me.id}`, { method: 'DELETE' });
                dropGroup(id);
                setPanel(false);
              }, 'You left the group')
            }
          >
            <LogOut size={16} />
            Leave group
          </button>

          {owner && (
            <button
              className="flex w-full items-center gap-2.5 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition"
              onClick={() =>
                run(async () => {
                  await api(`/groups/${id}`, { method: 'DELETE' });
                  dropGroup(id);
                  setActive(null);
                }, 'Group deleted')
              }
            >
              <Trash2 size={16} />
              Delete group
            </button>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          {mod && (
            <div className="space-y-2 rounded-2xl border border-border bg-surface-hover/30 p-2.5">
              <div className="flex gap-1.5">
                <input
                  className="field !py-1 !text-xs"
                  placeholder="Username to add"
                  aria-label="Username to add"
                  value={add}
                  onChange={(e) => setAdd(e.target.value)}
                />
                <select
                  className="field !w-28 !py-1 !text-xs bg-surface"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                >
                  {allRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn-grad w-full rounded-lg py-1.5 text-xs font-semibold"
                disabled={!add.trim()}
                onClick={() =>
                  run(async () => {
                    const v = add.trim();
                    await api(`/groups/${id}/members`, {
                      body: {
                        ...(/^[a-f0-9]{24}$/.test(v) ? { userId: v } : { username: v }),
                        role: addRole,
                      },
                    });
                    setAdd('');
                  }, 'Member added')
                }
              >
                Add Member
              </button>
            </div>
          )}

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {list.map((m: Member) => (
              <div
                key={m.userId}
                className="rounded-xl border border-border/60 bg-surface/80 p-2 hover:bg-surface-hover transition space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={m.displayName || m.username} size={34} online={m.online} src={avatarUrl(m.userId)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-xs font-semibold text-ink">
                      {m.displayName || m.username}
                      {m.admin === 'admin' && <Crown size={12} className="text-amber-500 shrink-0" />}
                      {m.admin === 'coadmin' && <Shield size={12} className="text-accent shrink-0" />}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      @{m.username} · <span className="text-accent font-medium">{m.role}</span>
                    </p>
                  </div>
                  {mod && m.userId !== me.id && m.admin !== 'admin' && (owner || m.admin === 'none') && (
                    <button
                      aria-label={`Remove ${m.username}`}
                      className="rounded-full p-1 text-rose-500 hover:bg-rose-500/10 transition"
                      onClick={() =>
                        run(() => api(`/groups/${id}/members/${m.userId}`, { method: 'DELETE' }), 'Member removed')
                      }
                    >
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>

                {mod && m.admin !== 'admin' && (owner || m.admin === 'none') && (
                  <div className="flex gap-1.5 pl-10 pt-1">
                    <select
                      aria-label={`Role for ${m.username}`}
                      className="field !w-auto !py-0.5 !text-[11px] bg-surface"
                      value={allRoles.includes(m.role) ? m.role : '__c'}
                      onChange={(e) => {
                        const v =
                          e.target.value === '__c'
                            ? (window.prompt('Custom role name:') ?? '').trim()
                            : e.target.value;
                        if (v)
                          run(
                            () =>
                              api(`/groups/${id}/members/${m.userId}`, {
                                method: 'PATCH',
                                body: { role: v.slice(0, 30) },
                              }),
                            'Role updated'
                          );
                      }}
                    >
                      {allRoles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      <option value="__c">
                        {allRoles.includes(m.role) ? 'Custom...' : m.role}
                      </option>
                    </select>

                    {owner && (
                      <button
                        className="rounded-lg border border-border px-2 text-[10px] font-medium hover:bg-surface-hover transition"
                        onClick={() =>
                          run(
                            () =>
                              api(`/groups/${id}/members/${m.userId}`, {
                                method: 'PATCH',
                                body: { admin: m.admin === 'coadmin' ? 'none' : 'coadmin' },
                              }),
                            'Privilege updated'
                          )
                        }
                      >
                        {m.admin === 'coadmin' ? 'Remove co-admin' : 'Make co-admin'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'media' &&
        (media === null ? (
          <Spinner />
        ) : !media.length ? (
          <Empty
            icon={<Img size={28} />}
            title="No media attachments"
            hint="Files and photos sent in this group will be collected here."
          />
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto">
            {media.map((m, i) =>
              (m.type ?? '').startsWith('image/') ? (
                <img
                  key={i}
                  src={fileUrl(m.href)}
                  alt={m.name}
                  draggable={false}
                  className="aspect-square rounded-lg object-cover border border-border/50"
                />
              ) : (
                <div
                  key={i}
                  className="grid aspect-square place-items-center rounded-lg border border-border/60 bg-surface-hover/50 p-1 text-center text-[10px] text-muted"
                >
                  <FileText size={18} className="text-accent" />
                  <span className="line-clamp-2 break-all text-[9px]">{m.name}</span>
                </div>
              )
            )}
          </div>
        ))}

      {tab === 'pinned' &&
        (pins === null ? (
          <Spinner />
        ) : !pins.length ? (
          <Empty
            icon={<Pin size={28} />}
            title="No pinned messages"
            hint="Important messages can be pinned by administrators."
          />
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {pins.map((p) => (
              <p
                key={p._id}
                className="rounded-xl border border-border/80 bg-surface-hover/30 p-2.5 text-xs text-ink"
              >
                {p.content || 'Attachment'}
              </p>
            ))}
          </div>
        ))}
    </div>
  );
}
