import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  MessageCircle,
  UserPlus,
  Users,
  Bell,
  LogOut,
  Check,
  ImagePlus,
  Ban,
  Sun,
  Moon,
  Shield,
  ShieldAlert,
  Plus,
  Trash2,
  Pencil,
  UserCheck,
  Eye,
  Forward,
  Copy,
  Download,
  Reply,
  SmilePlus,
  Activity,
  CameraOff,
} from 'lucide-react';
import { api, avatarUrl, upload } from '../lib/api';
import { THEMES, WALLPAPERS, applyTheme, getPersistedTheme } from '../lib/themes';
import { ago } from '../lib/hooks';
import type { CustomRole, MessageActivityResponse, Msg, ActivityAction } from '../lib/types';
import { useUI, type ActivityTab } from '../store/ui';
import { useAuth } from '../store/auth';
import { useChat } from '../store/chat';
import { Modal, Toggle, Spinner, Empty } from './Modal';
import { Avatar } from './Avatar';
import { storyBus } from './Stories';

export function ModalHost() {
  const { modal, close } = useUI();
  return (
    <AnimatePresence>
      {modal?.k === 'settings' && <Settings key="s" onClose={close} />}
      {modal?.k === 'roles' && <RolesManager key="rm" onClose={close} />}
      {modal?.k === 'newgroup' && <NewGroup key="g" onClose={close} />}
      {modal?.k === 'people' && <People key="p" onClose={close} />}
      {modal?.k === 'story' && <StoryNew key="st" onClose={close} />}
      {modal?.k === 'notifs' && <Notifs key="n" onClose={close} />}
      {modal?.k === 'forward' && <ForwardModal key="f" id={modal.msg._id} onClose={close} />}
      {modal?.k === 'activity' && (
        <MessageActivityModal key="act" msg={modal.msg} initialTab={modal.tab} onClose={close} />
      )}
      {modal?.k === 'report' && <Report key="r" type={modal.type} id={modal.id} onClose={close} />}
    </AnimatePresence>
  );
}

function Settings({ onClose }: { onClose: () => void }) {
  const me = useAuth((s) => s.user)!;
  const { saveSettings, logout, setUser } = useAuth();
  const { toast, open } = useUI();
  const st = me.settings ?? {};
  const np = st.notifications ?? {};

  const [name, setName] = useState(me.displayName ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [status, setStatus] = useState(me.status ?? '');
  const [blocked, setBlocked] = useState<any[] | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>(
    (st.theme as 'light' | 'dark') ?? getPersistedTheme()
  );

  useEffect(() => {
    api('/users/blocked').then(setBlocked).catch(() => setBlocked([]));
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setActiveTheme(newTheme);
    applyTheme(newTheme, undefined, st.fontSize);
    saveSettings({ theme: newTheme }).catch((e) => toast(e.message, 'error'));
  };

  const set = (s: any) => saveSettings(s).catch((e) => toast(e.message, 'error'));

  const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <section className="mb-6">
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-accent">{t}</h3>
      {children}
    </section>
  );

  const isManager = me.role === 'Manager';

  return (
    <Modal title="Settings & Appearance" onClose={onClose} wide>
      {/* Profile Section */}
      <Sec t="Profile">
        <div className="flex items-center gap-4">
          <button
            aria-label="Change photo"
            onClick={() => file.current?.click()}
            className="relative transition-transform hover:scale-105"
          >
            <Avatar name={name || me.username} size={70} src={avatarUrl(me.id)} />
            <span className="btn-grad absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full shadow-sm">
              <ImagePlus size={13} />
            </span>
          </button>
          <input
            ref={file}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const u = await upload(f, f.name);
                const r = await api('/users/me', { method: 'PATCH', body: { avatarKey: u.key } });
                setUser({ ...me, ...r });
                toast('Profile picture updated successfully', 'success');
              } catch (er: any) {
                toast(er.message, 'error');
              }
            }}
          />
          <div className="flex-1 space-y-1.5">
            <input
              className="field"
              aria-label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
            />
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted">@{me.username}</p>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {me.role}
              </span>
            </div>
          </div>
        </div>
        <input
          className="field mt-2.5"
          aria-label="Status message"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status message"
        />
        <textarea
          className="field mt-2"
          rows={2}
          aria-label="Biography"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="About yourself / bio"
        />
        <button
          className="btn-grad mt-2.5 rounded-xl px-4 py-2 text-xs font-semibold"
          onClick={async () => {
            try {
              setUser({
                ...me,
                ...(await api('/users/me', {
                  method: 'PATCH',
                  body: { displayName: name, bio, status },
                })),
              });
              toast('Profile updated', 'success');
            } catch (e: any) {
              toast(e.message, 'error');
            }
          }}
        >
          Save Profile Details
        </button>
      </Sec>

      {/* Role Management Shortcut for Managers */}
      {isManager && (
        <Sec t="Administration">
          <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3.5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-ink flex items-center gap-1.5">
                <Shield size={16} className="text-accent" />
                Custom Role Management
              </p>
              <p className="text-xs text-muted mt-0.5">
                Configure roles (Manager, GM, Team Leader, Staff), grant permissions & assign members.
              </p>
            </div>
            <button
              className="btn-grad rounded-xl px-4 py-2 text-xs font-semibold shrink-0"
              onClick={() => open({ k: 'roles' })}
            >
              Manage Roles
            </button>
          </div>
        </Sec>
      )}

      {/* Themes: Light and Dark */}
      <Sec t="Theme Appearance">
        <p className="text-xs text-muted mb-2.5">
          Select your visual appearance in our Royal Elegance palette.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const isSelected = activeTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleThemeChange(t.id)}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3.5 transition-all text-left ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-premium'
                    : 'border-border/80 bg-surface hover:border-accent/40'
                }`}
              >
                <div
                  className="h-16 w-full rounded-xl border border-border/40 grid place-items-center shadow-inner"
                  style={{ background: t.bg }}
                >
                  <div className="flex items-center gap-2">
                    {t.id === 'light' ? (
                      <Sun size={18} className="text-[#6546B8]" />
                    ) : (
                      <Moon size={18} className="text-[#A78BFA]" />
                    )}
                    <span
                      className="h-3 w-10 rounded-full shadow-sm"
                      style={{ background: `linear-gradient(90deg, ${t.b1}, ${t.b2})` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-xs font-semibold text-ink">{t.name}</span>
                  {isSelected && (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                      <Check size={12} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Sec>

      {/* Text Size */}
      <Sec t="Text Scaling">
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={(st.fontSize ?? 'medium') === s}
              onClick={() => set({ fontSize: s })}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition ${
                (st.fontSize ?? 'medium') === s
                  ? 'btn-grad'
                  : 'bg-surface border border-border hover:bg-surface-hover text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Sec>

      {/* Default Chat Wallpaper */}
      <Sec t="Luxury Chat Wallpapers">
        <div className="flex flex-wrap gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              type="button"
              aria-pressed={(st.wallpaper ?? 'none') === w.id}
              onClick={() => set({ wallpaper: w.id })}
              className={`h-14 w-20 rounded-xl border-2 text-xs font-medium transition ${
                (st.wallpaper ?? 'none') === w.id
                  ? 'border-accent shadow-sm'
                  : 'border-border hover:border-accent/40'
              }`}
              style={{ background: w.css || undefined }}
            >
              {w.name}
            </button>
          ))}
        </div>
      </Sec>

      {/* Notifications and Audio */}
      <Sec t="Notifications & Audio">
        <div className="rounded-2xl border border-border bg-surface-hover/30 p-1 space-y-0.5">
          <Toggle
            label="Personal direct message alerts"
            on={np.messages !== false}
            onChange={(v) => set({ notifications: { ...np, messages: v } })}
          />
          <Toggle
            label="Group channel message alerts"
            on={np.groups !== false}
            onChange={(v) => set({ notifications: { ...np, groups: v } })}
          />
          <Toggle
            label="Story updates from contacts"
            on={np.stories !== false}
            onChange={(v) => set({ notifications: { ...np, stories: v } })}
          />
          <Toggle
            label="Notification sound chime"
            on={st.sound !== false}
            onChange={(v) => set({ sound: v })}
          />
        </div>
        <label className="mt-3 flex items-center gap-3 px-2 text-xs text-muted">
          <span>Chime Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={st.soundVolume ?? 0.5}
            onChange={(e) => set({ soundVolume: +e.target.value })}
            className="flex-1 accent-[rgb(var(--c-accent))]"
          />
        </label>
      </Sec>

      {/* Blocked Users */}
      <Sec t="Blocked Accounts">
        {blocked === null ? (
          <Spinner />
        ) : !blocked.length ? (
          <p className="text-xs text-muted">You haven't blocked any accounts.</p>
        ) : (
          blocked.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/40">
              <Avatar name={b.displayName || b.username} size={32} />
              <span className="flex-1 text-xs text-ink">@{b.username}</span>
              <button
                className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-hover transition"
                onClick={() =>
                  api(`/users/${b.id}/block`, { method: 'DELETE' }).then(() =>
                    setBlocked(blocked.filter((x) => x.id !== b.id))
                  )
                }
              >
                Unblock
              </button>
            </div>
          ))
        )}
      </Sec>

      {/* Logout button */}
      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/60 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition mt-4"
        onClick={async () => {
          await logout();
          location.href = '/login';
        }}
      >
        <LogOut size={15} />
        Log out of Connecta
      </button>
    </Modal>
  );
}

// -------------------------------------------------------------
// CUSTOM ROLE MANAGEMENT MODAL (Manager / Authorized Admin only)
// -------------------------------------------------------------
function RolesManager({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const [tab, setTab] = useState<'roles' | 'users'>('roles');
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New role form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [perms, setPerms] = useState({
    canManageRoles: false,
    canCreateGroups: true,
    canDeleteAnyMessage: false,
    canPinMessages: false,
    canAnnounce: false,
    canInvite: true,
  });

  // Editing state
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPerms, setEditPerms] = useState<any>({});

  // User search
  const [userQuery, setUserQuery] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [r, u] = await Promise.all([
        api<CustomRole[]>('/roles'),
        api<any[]>('/users/all'),
      ]);
      setRoles(r);
      setUsers(u);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      const created = await api<CustomRole>('/roles', {
        body: {
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permissions: perms,
        },
      });
      toast(`Role "${created.name}" created successfully`, 'success');
      setNewRoleName('');
      setNewRoleDesc('');
      setPerms({
        canManageRoles: false,
        canCreateGroups: true,
        canDeleteAnyMessage: false,
        canPinMessages: false,
        canAnnounce: false,
        canInvite: true,
      });
      loadData();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const saveEditRole = async () => {
    if (!editingRole?._id) return;
    try {
      await api(`/roles/${editingRole._id}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          description: editDesc.trim(),
          permissions: editPerms,
        },
      });
      toast('Role updated successfully', 'success');
      setEditingRole(null);
      loadData();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const deleteRole = async (r: CustomRole) => {
    if (!r._id || r.isSystem) return;
    if (!window.confirm(`Delete role "${r.name}"? Users with this role will be migrated to Staff.`)) return;
    try {
      await api(`/roles/${r._id}`, { method: 'DELETE' });
      toast(`Role "${r.name}" deleted. Associated users safely migrated to Staff.`, 'success');
      loadData();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const assignUserRole = async (userId: string, newRole: string) => {
    try {
      await api(`/users/${userId}/role`, {
        method: 'PATCH',
        body: { role: newRole },
      });
      toast('User role updated and permissions synchronized', 'success');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(userQuery.toLowerCase()) ||
      (u.displayName || '').toLowerCase().includes(userQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(userQuery.toLowerCase())
  );

  return (
    <Modal title="Custom Role & Permission Management" onClose={onClose} wide>
      {/* Navigation tabs */}
      <div className="flex gap-2 border-b border-border/80 pb-3 mb-4">
        <button
          className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
            tab === 'roles' ? 'btn-grad' : 'bg-surface-hover text-muted hover:text-ink'
          }`}
          onClick={() => setTab('roles')}
        >
          Roles & Permissions Hierarchy
        </button>
        <button
          className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
            tab === 'users' ? 'btn-grad' : 'bg-surface-hover text-muted hover:text-ink'
          }`}
          onClick={() => setTab('users')}
        >
          User Role Assignment
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'roles' ? (
        <div className="space-y-5">
          {/* Create new role section */}
          <div className="rounded-2xl border border-border bg-surface-hover/30 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-accent mb-2.5 flex items-center gap-1.5">
              <Plus size={15} />
              Create Custom Role
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5">
              <input
                className="field !text-xs !py-1.5"
                placeholder="Role name (e.g. Project Lead)"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
              <input
                className="field !text-xs !py-1.5"
                placeholder="Role description (optional)"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
              />
            </div>
            <p className="text-[11px] font-semibold text-muted mb-1.5">Granular Permissions:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.canManageRoles}
                  onChange={(e) => setPerms({ ...perms, canManageRoles: e.target.checked })}
                  className="accent-[rgb(var(--c-accent))]"
                />
                <span>Manage Roles</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.canCreateGroups}
                  onChange={(e) => setPerms({ ...perms, canCreateGroups: e.target.checked })}
                  className="accent-[rgb(var(--c-accent))]"
                />
                <span>Create Groups</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.canDeleteAnyMessage}
                  onChange={(e) => setPerms({ ...perms, canDeleteAnyMessage: e.target.checked })}
                  className="accent-[rgb(var(--c-accent))]"
                />
                <span>Delete Messages</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.canPinMessages}
                  onChange={(e) => setPerms({ ...perms, canPinMessages: e.target.checked })}
                  className="accent-[rgb(var(--c-accent))]"
                />
                <span>Pin Messages</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.canAnnounce}
                  onChange={(e) => setPerms({ ...perms, canAnnounce: e.target.checked })}
                  className="accent-[rgb(var(--c-accent))]"
                />
                <span>Announcements</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.canInvite}
                  onChange={(e) => setPerms({ ...perms, canInvite: e.target.checked })}
                  className="accent-[rgb(var(--c-accent))]"
                />
                <span>Invite Members</span>
              </label>
            </div>
            <button
              disabled={!newRoleName.trim()}
              onClick={createRole}
              className="btn-grad rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Add Custom Role
            </button>
          </div>

          {/* Existing Roles List */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Configured Roles ({roles.length})
            </h4>
            {roles.map((r) => {
              const isEditing = editingRole?._id === r._id;

              return (
                <div
                  key={r.name}
                  className="rounded-2xl border border-border/80 bg-surface p-3.5 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{r.name}</span>
                        {r.isSystem ? (
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                            System Role
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            Custom Role
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{r.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Edit role"
                        onClick={() => {
                          if (isEditing) {
                            setEditingRole(null);
                          } else {
                            setEditingRole(r);
                            setEditName(r.name);
                            setEditDesc(r.description || '');
                            setEditPerms(r.permissions || {});
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-ink transition"
                      >
                        <Pencil size={14} />
                      </button>
                      {!r.isSystem && (
                        <button
                          title="Delete role"
                          onClick={() => deleteRole(r)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {isEditing ? (
                    <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          className="field !text-xs !py-1.5"
                          value={editName}
                          disabled={r.name === 'Manager'}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Role name"
                        />
                        <input
                          className="field !text-xs !py-1.5"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Role description"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={r.name === 'Manager' ? true : !!editPerms.canManageRoles}
                            disabled={r.name === 'Manager'}
                            onChange={(e) =>
                              setEditPerms({ ...editPerms, canManageRoles: e.target.checked })
                            }
                            className="accent-[rgb(var(--c-accent))]"
                          />
                          <span>Manage Roles</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editPerms.canCreateGroups}
                            onChange={(e) =>
                              setEditPerms({ ...editPerms, canCreateGroups: e.target.checked })
                            }
                            className="accent-[rgb(var(--c-accent))]"
                          />
                          <span>Create Groups</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editPerms.canDeleteAnyMessage}
                            onChange={(e) =>
                              setEditPerms({ ...editPerms, canDeleteAnyMessage: e.target.checked })
                            }
                            className="accent-[rgb(var(--c-accent))]"
                          />
                          <span>Delete Messages</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editPerms.canPinMessages}
                            onChange={(e) =>
                              setEditPerms({ ...editPerms, canPinMessages: e.target.checked })
                            }
                            className="accent-[rgb(var(--c-accent))]"
                          />
                          <span>Pin Messages</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editPerms.canAnnounce}
                            onChange={(e) =>
                              setEditPerms({ ...editPerms, canAnnounce: e.target.checked })
                            }
                            className="accent-[rgb(var(--c-accent))]"
                          />
                          <span>Announcements</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!editPerms.canInvite}
                            onChange={(e) =>
                              setEditPerms({ ...editPerms, canInvite: e.target.checked })
                            }
                            className="accent-[rgb(var(--c-accent))]"
                          />
                          <span>Invite Members</span>
                        </label>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
                          onClick={() => setEditingRole(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-grad rounded-lg px-4 py-1.5 text-xs font-semibold"
                          onClick={saveEditRole}
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Permissions Pills */
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(r.permissions || {})
                        .filter(([_, enabled]) => enabled)
                        .map(([pKey]) => (
                          <span
                            key={pKey}
                            className="rounded-full bg-surface-hover px-2.5 py-0.5 text-[10px] font-medium text-muted border border-border/60"
                          >
                            ✓ {pKey.replace(/^can/, '')}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* User Role Assignment Tab */
        <div className="space-y-3">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-3 text-muted" />
            <input
              className="field !pl-9 !text-xs !py-2"
              placeholder="Filter members by username, name, or role..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
          </div>

          <div className="divide-y divide-border/60 max-h-[50vh] overflow-y-auto">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2.5 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={u.displayName || u.username} size={36} src={u.hasAvatar ? avatarUrl(u.id) : undefined} />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-ink truncate">
                      {u.displayName || u.username}
                    </p>
                    <p className="text-[11px] text-muted truncate">@{u.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="field !w-auto !py-1 !text-xs bg-surface border-border font-medium"
                    value={u.role}
                    onChange={(e) => assignUserRole(u.id, e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {!filteredUsers.length && (
              <p className="p-4 text-center text-xs text-muted">No members match your search.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function NewGroup({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const { loadChats, setActive } = useChat();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [u, setU] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const addName = (v: string) => {
    const x = v.trim().toLowerCase();
    if (x && !names.includes(x)) setNames([...names, x]);
    setU('');
  };

  return (
    <Modal title="Create New Group Workspace" onClose={onClose}>
      <div className="space-y-3">
        <input
          className="field"
          placeholder="Group name"
          aria-label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <textarea
          className="field"
          rows={2}
          placeholder="Group description (optional)"
          aria-label="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-hover/40 px-3.5 py-2.5 text-xs text-muted hover:bg-surface-hover hover:text-ink transition">
          <ImagePlus size={16} className="text-accent" />
          {photo ? photo.name : 'Attach group avatar photo (optional)'}
          <input
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex gap-2">
          <input
            className="field"
            placeholder="Add member by username..."
            aria-label="Member username"
            value={u}
            onChange={(e) => setU(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addName(u)}
          />
          <button
            className="rounded-xl border border-border px-4 text-xs font-semibold text-ink hover:bg-surface-hover transition"
            onClick={() => addName(u)}
          >
            Add
          </button>
        </div>
        <button
          className="text-xs text-accent hover:underline font-medium block"
          onClick={async () => {
            try {
              const c = await api<any[]>('/contacts');
              setNames([...new Set([...names, ...c.map((x) => x.username)])]);
            } catch (e: any) {
              toast(e.message, 'error');
            }
          }}
        >
          + Add all contacts
        </button>
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <button
              key={n}
              onClick={() => setNames(names.filter((x) => x !== n))}
              className="rounded-full bg-accent/15 border border-accent/25 px-2.5 py-1 text-xs text-accent hover:bg-accent/25 transition"
              aria-label={`Remove ${n}`}
            >
              @{n} ×
            </button>
          ))}
        </div>
        <button
          disabled={!name.trim() || busy}
          className="btn-grad w-full rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              const photoKey = photo ? (await upload(photo, photo.name)).key : undefined;
              const r = await api('/groups', {
                body: {
                  name,
                  description: desc,
                  photoKey,
                  members: names.map((n) => ({ username: n })),
                },
              });
              await loadChats();
              setActive({ type: 'group', id: r.group._id });
              toast(
                r.notFound.length
                  ? `Group created. Not found: ${r.notFound.join(', ')}`
                  : 'Group created successfully',
                r.notFound.length ? 'warn' : 'success'
              );
              onClose();
            } catch (e: any) {
              toast(e.message, 'error');
              setBusy(false);
            }
          }}
        >
          Create Group
        </button>
      </div>
    </Modal>
  );
}

function People({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const { setActive } = useChat();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[] | null>(null);
  const [contacts, setContacts] = useState<any[] | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    api('/contacts')
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    const t = setTimeout(
      () =>
        api(`/users/search?q=${encodeURIComponent(q.trim())}`)
          .then(setRes)
          .catch((e) => toast(e.message, 'error')),
      250
    );
    return () => clearTimeout(t);
  }, [q]);

  const list = res ?? contacts;

  return (
    <Modal title="Directory & Contacts" onClose={onClose}>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-3 text-muted" />
        <input
          autoFocus
          className="field !pl-9 text-xs"
          placeholder="Search by username..."
          aria-label="Search users"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {list === null ? (
        <Spinner />
      ) : !list.length ? (
        <Empty
          icon={<Users size={30} />}
          title={res ? 'No members found' : 'No contacts saved yet'}
          hint={res ? 'Verify the username query.' : 'Search any colleague by username to connect.'}
        />
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {list.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-surface-hover transition"
            >
              <Avatar
                name={u.displayName || u.username}
                size={40}
                online={u.online}
                src={u.hasAvatar ? avatarUrl(u.id) : undefined}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">
                  {u.displayName || u.username}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span>@{u.username}</span>
                  <span>·</span>
                  <span className="text-accent font-medium">{u.role}</span>
                </div>
              </div>
              <button
                aria-label={`Message ${u.username}`}
                className="btn-grad rounded-full p-2 text-white"
                onClick={() => {
                  setActive({ type: 'dm', id: u.id });
                  onClose();
                }}
              >
                <MessageCircle size={15} />
              </button>
              <button
                aria-label={`Add ${u.username} to contacts`}
                className="rounded-full border border-border p-2 text-muted hover:bg-surface-hover hover:text-ink transition"
                onClick={() =>
                  api('/contacts', { body: { username: u.username } })
                    .then(() => {
                      toast('Added to contacts', 'success');
                      api('/contacts').then(setContacts);
                    })
                    .catch((e) => toast(e.message, 'error'))
                }
              >
                <UserPlus size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Join with invite code */}
      <div className="mt-4 border-t border-border/80 pt-3.5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Join with invite code
        </p>
        <div className="flex gap-2">
          <input
            className="field !text-xs"
            placeholder="12-character code"
            aria-label="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
          />
          <button
            className="rounded-xl border border-border px-4 text-xs font-semibold text-ink hover:bg-surface-hover transition"
            onClick={() =>
              api(`/groups/join/${code}`, { method: 'POST', body: {} })
                .then(async (r) => {
                  await useChat.getState().loadChats();
                  setActive({ type: 'group', id: r.groupId });
                  toast(`Joined ${r.name}`, 'success');
                  onClose();
                })
                .catch((e) => toast(e.message, 'error'))
            }
          >
            Join
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StoryNew({ onClose }: { onClose: () => void }) {
  const { toast } = useUI();
  const [text, setText] = useState('');
  const [bg, setBg] = useState('#6546B8');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Share a 24-Hour Story" onClose={onClose}>
      <div className="space-y-3">
        <div
          className="grid h-48 place-items-center rounded-2xl p-4 text-center shadow-inner"
          style={{ background: `linear-gradient(135deg, ${bg}, #A78BFA)` }}
        >
          <p className="display text-xl font-bold text-white drop-shadow-sm">
            {text || 'Your story preview'}
          </p>
        </div>
        <input
          className="field"
          maxLength={300}
          placeholder="Share an update or thought..."
          aria-label="Story text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-hover/40 px-3.5 py-2.5 text-xs text-muted hover:text-ink transition">
            <ImagePlus size={16} className="text-accent" />
            {file ? file.name : 'Photo or video'}
            <input
              hidden
              type="file"
              accept="image/*,video/mp4,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <input
            type="color"
            aria-label="Background colour"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-xl bg-transparent"
          />
        </div>
        <button
          disabled={busy || (!text.trim() && !file)}
          className="btn-grad w-full rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              const mediaKey = file ? (await upload(file, file.name)).key : undefined;
              await api('/stories', {
                body: { text: text || undefined, bg, mediaKey },
              });
              toast('Story posted', 'success');
              storyBus.reload();
              onClose();
            } catch (e: any) {
              toast(e.message, 'error');
              setBusy(false);
            }
          }}
        >
          Post Story
        </button>
      </div>
    </Modal>
  );
}

function Notifs({ onClose }: { onClose: () => void }) {
  const { notifs, loadNotifs, setActive } = useChat();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadNotifs().then(() => {
      setReady(true);
      api('/notifications/read', { method: 'POST', body: {} }).then(() =>
        useChat.setState({ unreadNotifs: 0 })
      );
    });
  }, []);

  return (
    <Modal title="Notifications" onClose={onClose}>
      {!ready ? (
        <Spinner />
      ) : !notifs.length ? (
        <Empty
          icon={<Bell size={30} />}
          title="All caught up"
          hint="Direct mentions, confidential alerts, and replies will show here."
        />
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {notifs.map((n) => (
            <button
              key={n._id ?? n.id}
              onClick={() => {
                const d = n.data ?? {};
                if (d.groupId) setActive({ type: 'group', id: d.groupId });
                else if (d.fromUserId) setActive({ type: 'dm', id: d.fromUserId });
                onClose();
              }}
              className="flex w-full items-start gap-3 rounded-2xl p-2.5 text-left hover:bg-surface-hover transition"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  n.read ? 'bg-transparent' : 'bg-accent'
                }`}
              />
              <span className="flex-1 text-xs text-ink leading-relaxed">
                {n.text}
                <span className="block text-[10px] text-muted mt-0.5">{ago(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ForwardModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { chats } = useChat();
  const toast = useUI((s) => s.toast);
  const [sent, setSent] = useState<string[]>([]);

  return (
    <Modal title="Forward Message" onClose={onClose}>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {chats.map((c) => {
          const k = c.type + c.id;
          return (
            <button
              key={k}
              className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-hover transition"
              onClick={async () => {
                try {
                  await api(`/messages/${id}/forward`, {
                    body: c.type === 'group' ? { groupId: c.id } : { userId: c.id },
                  });
                  setSent([...sent, k]);
                  toast(`Forwarded to ${c.name}`, 'success');
                } catch (e: any) {
                  toast(e.message, 'error');
                }
              }}
            >
              <Avatar name={c.name} size={36} />
              <span className="flex-1 text-xs font-semibold text-ink">{c.name}</span>
              {sent.includes(k) ? (
                <Check size={16} className="text-emerald-500" />
              ) : (
                <span className="text-[11px] text-muted">
                  {c.type === 'group' ? 'Group' : 'Direct'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function Report({
  type,
  id,
  onClose,
}: {
  type: 'user' | 'message';
  id: string;
  onClose: () => void;
}) {
  const toast = useUI((s) => s.toast);
  const [reason, setReason] = useState('');

  return (
    <Modal title={`Report ${type}`} onClose={onClose}>
      <p className="mb-2.5 flex items-center gap-2 text-xs text-muted">
        <Ban size={15} className="text-rose-500" />
        Confidential report sent directly to the Manager for administrative review.
      </p>
      <textarea
        className="field !text-xs"
        rows={4}
        autoFocus
        placeholder="Please describe what violation occurred..."
        aria-label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        disabled={reason.trim().length < 3}
        className="btn-grad mt-3 w-full rounded-xl py-2.5 font-semibold text-xs disabled:opacity-50"
        onClick={() =>
          api('/reports', { body: { type, targetId: id, reason } })
            .then(() => {
              toast('Report submitted for administrative review', 'success');
              onClose();
            })
            .catch((e) => toast(e.message, 'error'))
        }
      >
        Submit Report
      </button>
    </Modal>
  );
}

const ACTION_META: Record<
  ActivityAction,
  { label: string; verb: string; icon: React.ReactNode }
> = {
  VIEW: { label: 'Viewed', verb: 'viewed this message', icon: <Eye size={14} /> },
  EDIT: { label: 'Edited', verb: 'edited this message', icon: <Pencil size={14} /> },
  FORWARD: { label: 'Forwarded', verb: 'forwarded this message', icon: <Forward size={14} /> },
  COPY: { label: 'Copied', verb: 'copied this message', icon: <Copy size={14} /> },
  DOWNLOAD: { label: 'Downloaded', verb: 'downloaded an attachment', icon: <Download size={14} /> },
  REPLY: { label: 'Replied', verb: 'replied to this message', icon: <Reply size={14} /> },
  REACT: { label: 'Reacted', verb: 'reacted to this message', icon: <SmilePlus size={14} /> },
};

function MessageActivityModal({
  msg,
  initialTab = 'ALL',
  onClose,
}: {
  msg: Msg;
  initialTab?: ActivityTab;
  onClose: () => void;
}) {
  const [data, setData] = useState<MessageActivityResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<ActivityTab>(initialTab);

  useEffect(() => {
    api<MessageActivityResponse>(`/messages/${msg._id}/activity`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [msg._id]);

  // Real-time activity updates via Socket.IO
  useEffect(() => {
    const onAct = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (!detail || detail.messageId !== msg._id || !detail.activity) return;
      setData((prev) => {
        if (!prev) return prev;
        if (prev.activities.some((a) => a.activityId === detail.activity.activityId)) return prev;
        const actionType = detail.activity.actionType as ActivityAction;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            [actionType]: (prev.summary[actionType] ?? 0) + 1,
            total: prev.summary.total + 1,
          },
          activities: [detail.activity, ...prev.activities],
        };
      });
    };
    window.addEventListener('connecta:activity', onAct);
    return () => window.removeEventListener('connecta:activity', onAct);
  }, [msg._id]);

  const filtered =
    data?.activities.filter((a) => tab === 'ALL' || a.actionType === tab) ?? [];

  const perm = data?.message.perm ?? msg.perm ?? {};

  return (
    <Modal title="Message Activity & Audit History" onClose={onClose} wide>
      {err ? (
        <Empty
          icon={<ShieldAlert size={30} className="text-rose-500" />}
          title="Access Denied"
          hint={err}
        />
      ) : !data ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {/* Header Info Card */}
          <div className="glass-card rounded-2xl p-4 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-accent uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Activity size={14} />
                Message Activity
              </span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                {data.message.senderRole}
              </span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 pt-1">
              <p className="text-ink">
                <span className="text-muted">Original Sender: </span>
                <span className="font-semibold">{data.message.senderName}</span>
              </p>
              <p className="text-ink">
                <span className="text-muted">Sent Date: </span>
                <span className="font-medium">
                  {new Date(data.message.createdAt).toLocaleString()}
                </span>
              </p>
            </div>
            <p className="text-[11px] text-muted font-mono truncate">
              Message ID: {data.message._id}
            </p>
          </div>

          {/* Activity Summary */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent">
              Activity Summary
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {(
                [
                  ['VIEW', 'Views'],
                  ['EDIT', 'Edits'],
                  ['FORWARD', 'Forwards'],
                  ['COPY', 'Copies'],
                  ['DOWNLOAD', 'Downloads'],
                  ['REPLY', 'Replies'],
                  ['REACT', 'Reactions'],
                ] as [ActivityAction, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-xl border p-2 text-center transition ${
                    tab === k
                      ? 'border-accent bg-accent/15 shadow-sm'
                      : 'border-border bg-surface hover:bg-surface-hover'
                  }`}
                >
                  <p className="display text-lg font-extrabold text-ink">
                    {data.summary[k] ?? 0}
                  </p>
                  <p className="text-[10px] font-medium text-muted truncate">{label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ALL', 'All Activities'],
                ['VIEW', 'Viewed'],
                ['EDIT', 'Edited'],
                ['FORWARD', 'Forwarded'],
                ['COPY', 'Copied'],
                ['DOWNLOAD', 'Downloaded'],
                ['REPLY', 'Replied'],
                ['REACT', 'Reacted'],
                ['PERMS', 'Permission Details'],
              ] as [ActivityTab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  tab === k
                    ? 'btn-grad text-white'
                    : 'border border-border bg-surface text-muted hover:text-ink hover:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content: Permission Details OR Activity Timeline */}
          {tab === 'PERMS' ? (
            <div className="glass-card rounded-2xl p-4 space-y-2.5 text-xs">
              <p className="font-bold text-ink flex items-center gap-1.5">
                <Shield size={15} className="text-accent" />
                Configured Message Permissions
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-surface p-2.5 border border-border/60">
                  <span className="text-muted block text-[10px]">Audience Mode</span>
                  <span className="font-semibold text-ink capitalize">
                    {perm.viewMode === 'custom' ? 'Restricted Audience' : 'Everyone in chat'}
                  </span>
                </div>
                <div className="rounded-xl bg-surface p-2.5 border border-border/60">
                  <span className="text-muted block text-[10px]">Screenshot Protection</span>
                  <span className="font-semibold text-ink flex items-center gap-1">
                    <CameraOff size={12} className="text-accent" />
                    {perm.screenshotProtected || perm.allowScreenshot === false
                      ? 'Restricted'
                      : 'Allowed'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  ['Copy', perm.allowCopy],
                  ['Forward', perm.allowForward],
                  ['Download', perm.allowDownload],
                  ['Reply', perm.allowReply !== false],
                  ['React', perm.allowReact !== false],
                ].map(([label, allowed]) => (
                  <span
                    key={String(label)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                      allowed
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {label}: {allowed ? 'Allowed' : 'Restricted'}
                  </span>
                ))}
              </div>
              {perm.expiresAt && (
                <p className="text-[11px] text-muted">
                  Expires at: {new Date(perm.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {!filtered.length ? (
                <Empty
                  icon={<Activity size={28} />}
                  title="No recorded activity yet"
                  hint="Authorized user actions on this message will appear here in real time."
                />
              ) : (
                filtered.map((a) => {
                  const meta = ACTION_META[a.actionType];
                  return (
                    <div
                      key={a.activityId}
                      className="rounded-2xl border border-border bg-surface p-3 text-xs space-y-2"
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar
                          name={a.performedByDisplayName || a.performedByUsername}
                          src={a.hasAvatar ? avatarUrl(a.performedByUserId) : undefined}
                          size={34}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-ink truncate">
                                {a.performedByDisplayName || a.performedByUsername}
                              </span>
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                {a.performedByRole}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted shrink-0">
                              {new Date(a.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-muted">
                            <span className="text-accent">{meta.icon}</span>
                            <span className="text-ink/90">
                              {meta.verb}
                              {a.actionType === 'FORWARD' && a.destinationName
                                ? ` to ${a.destinationName}`
                                : ''}
                              {a.actionType === 'DOWNLOAD' && a.metadata?.fileName
                                ? ` (${a.metadata.fileName})`
                                : ''}
                              {a.actionType === 'REACT' && a.metadata?.emoji
                                ? ` with ${a.metadata.emoji}`
                                : ''}
                            </span>
                          </p>
                          {a.actionType === 'VIEW' &&
                            a.lastTimestamp &&
                            a.lastTimestamp !== a.timestamp && (
                              <p className="mt-0.5 text-[10px] text-muted">
                                Last viewed:{' '}
                                {new Date(a.lastTimestamp).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Edit Version History */}
                      {a.actionType === 'EDIT' &&
                        (a.metadata?.previousContent !== undefined ||
                          a.metadata?.updatedContent !== undefined) && (
                          <div className="ml-11 space-y-1.5 rounded-xl bg-surface-hover/60 p-2.5 text-[11px] border border-border/60">
                            <div>
                              <span className="font-semibold text-rose-500">Previous: </span>
                              <span className="text-muted line-through">
                                {a.metadata.previousContent}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                Updated:{' '}
                              </span>
                              <span className="text-ink">{a.metadata.updatedContent}</span>
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
