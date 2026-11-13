import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Pencil,
  Copy,
  Forward,
  Download,
  Reply,
  SmilePlus,
  Clock,
  ShieldCheck,
  CameraOff,
  Info,
} from 'lucide-react';
import { Modal, Toggle } from './Modal';
import { api } from '../lib/api';
import type { Member, CustomRole } from '../lib/types';

export type Audience =
  | 'everyone'
  | 'manager'
  | 'general_manager'
  | 'team_leader'
  | 'staff'
  | 'custom';

export interface PermState {
  audience: Audience;
  viewRoles: string[];
  viewMembers: string[];
  editRoles: string[];
  editMembers: string[];
  allowCopy: boolean;
  allowForward: boolean;
  allowDownload: boolean;
  allowReply: boolean;
  allowReact: boolean;
  allowScreenshot: boolean;
  screenshotProtected: boolean;
  expiry: 'none' | '1h' | '1d' | 'custom';
  expiresAt?: string;
}

export const DEFAULT_PERM: PermState = {
  audience: 'everyone',
  viewRoles: [],
  viewMembers: [],
  editRoles: [],
  editMembers: [],
  allowCopy: false,
  allowForward: false,
  allowDownload: false,
  allowReply: true,
  allowReact: true,
  allowScreenshot: true,
  screenshotProtected: false,
  expiry: 'none',
};

export const isDefault = (p: PermState) => JSON.stringify(p) === JSON.stringify(DEFAULT_PERM);

export function toApi(p: PermState) {
  let roles: string[] = [];
  if (p.audience === 'manager') roles = ['Manager'];
  else if (p.audience === 'general_manager') roles = ['General Manager'];
  else if (p.audience === 'team_leader') roles = ['Team Leader'];
  else if (p.audience === 'staff') roles = ['Staff'];
  else if (p.audience === 'custom') roles = p.viewRoles;

  const exp =
    p.expiry === '1h'
      ? new Date(Date.now() + 3600e3)
      : p.expiry === '1d'
      ? new Date(Date.now() + 86400e3)
      : p.expiry === 'custom' && p.expiresAt
      ? new Date(p.expiresAt)
      : undefined;

  return {
    viewMode: p.audience === 'everyone' ? 'everyone' : 'custom',
    viewRoles: roles,
    viewMembers: p.audience === 'custom' ? p.viewMembers : [],
    editRoles: p.editRoles,
    editMembers: p.editMembers,
    allowCopy: p.allowCopy,
    allowForward: p.allowForward,
    allowDownload: p.allowDownload,
    allowReply: p.allowReply,
    allowReact: p.allowReact,
    allowScreenshot: p.allowScreenshot,
    screenshotProtected: p.screenshotProtected,
    expiresAt: exp?.toISOString(),
  };
}

export function describe(p: PermState) {
  const whoMap: Record<Audience, string> = {
    everyone: 'Everyone',
    manager: 'Manager only',
    general_manager: 'General Manager only',
    team_leader: 'Team Leaders only',
    staff: 'Staff only',
    custom: 'Custom audience',
  };
  const who = whoMap[p.audience] ?? 'Custom';
  const editors = p.editRoles.length || p.editMembers.length ? ' · editors set' : ' · view-only';
  const sc = p.screenshotProtected ? ' · 📸 screenshot restricted' : '';
  const exp = p.expiry !== 'none' ? ' · expires' : '';
  return `${who}${editors}${sc}${exp}`;
}

const Chips = ({
  items,
  sel,
  on,
}: {
  items: string[];
  sel: string[];
  on: (v: string[]) => void;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((r) => {
      const a = sel.includes(r);
      return (
        <button
          key={r}
          type="button"
          aria-pressed={a}
          onClick={() => on(a ? sel.filter((x) => x !== r) : [...sel, r])}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            a ? 'btn-grad' : 'bg-surface-hover border border-border/80 hover:border-accent/40'
          }`}
        >
          {r}
        </button>
      );
    })}
  </div>
);

function Members({
  list,
  sel,
  on,
}: {
  list: Member[];
  sel: string[];
  on: (v: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const f = list.filter((m) =>
    (m.displayName + m.username).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <input
        className="field mb-2 !py-1.5 text-xs"
        placeholder="Filter members..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-36 overflow-y-auto rounded-xl bg-surface-hover/40 border border-border/70 p-1 space-y-0.5">
        {f.map((m) => (
          <label
            key={m.userId}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-surface-hover transition"
          >
            <input
              type="checkbox"
              checked={sel.includes(m.userId)}
              onChange={(e) =>
                on(
                  e.target.checked
                    ? [...sel, m.userId]
                    : sel.filter((x) => x !== m.userId)
                )
              }
              className="accent-[rgb(var(--c-accent))] rounded"
            />
            <span className="flex-1 font-medium text-ink">
              {m.displayName || m.username}
            </span>
            <span className="text-[10px] text-muted rounded-full bg-border/50 px-1.5 py-0.5">
              {m.role}
            </span>
          </label>
        ))}
        {!f.length && <p className="p-2 text-xs text-muted text-center">No matching members.</p>}
      </div>
    </div>
  );
}

const Sec = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-4">
    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
      <span className="text-accent">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

export function PermissionEditor({
  initial,
  members,
  meId,
  onSave,
  onClose,
}: {
  initial: PermState;
  members: Member[];
  meId: string;
  onSave: (p: PermState) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(initial);
  const set = (x: Partial<PermState>) => setP((s) => ({ ...s, ...x }));

  const [availableRoles, setAvailableRoles] = useState<string[]>([
    'Manager',
    'General Manager',
    'Team Leader',
    'Staff',
  ]);

  useEffect(() => {
    api<CustomRole[]>('/roles')
      .then((r) => {
        const names = r.map((x) => x.name);
        setAvailableRoles((prev) => [...new Set([...prev, ...names])]);
      })
      .catch(() => {});
  }, []);

  const others = useMemo(
    () => members.filter((m) => m.userId !== meId),
    [members, meId]
  );

  const roles = useMemo(
    () => [...new Set([...availableRoles, ...members.map((m) => m.role)])],
    [availableRoles, members]
  );

  const aud: [Audience, string][] = [
    ['everyone', 'Everyone'],
    ['manager', 'Manager only'],
    ['general_manager', 'General Manager only'],
    ['team_leader', 'Team Leader only'],
    ['staff', 'Staff only'],
    ['custom', 'Custom roles / members'],
  ];

  return (
    <Modal title="Message Permissions & Screenshot Policy" onClose={onClose} wide>
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-accent/10 border border-accent/25 p-3.5 text-xs text-ink/90 leading-relaxed">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <span className="font-semibold block text-accent">Server-Enforced Access Control:</span>
          Users outside the selected audience never receive this message payload. You can always view and edit your own message.
        </div>
      </div>

      {/* Audience */}
      <Sec icon={<Eye size={16} />} title="Who can view this message">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {aud.map(([id, l]) => (
            <button
              key={id}
              type="button"
              aria-pressed={p.audience === id}
              onClick={() => set({ audience: id })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                p.audience === id
                  ? 'btn-grad'
                  : 'bg-surface-hover border border-border/80 hover:border-accent/40'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {p.audience === 'custom' && (
          <div className="space-y-3 rounded-2xl border border-border bg-surface-hover/30 p-3 mt-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">Target Roles</p>
              <Chips items={roles} sel={p.viewRoles} on={(v) => set({ viewRoles: v })} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">Individual Members</p>
              <Members list={others} sel={p.viewMembers} on={(v) => set({ viewMembers: v })} />
            </div>
          </div>
        )}
      </Sec>

      {/* Editors */}
      <Sec icon={<Pencil size={16} />} title="Who can edit (editors can also copy, forward, and download)">
        <div className="space-y-3 rounded-2xl border border-border bg-surface-hover/30 p-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Roles</p>
            <Chips items={roles} sel={p.editRoles} on={(v) => set({ editRoles: v })} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Individual Members</p>
            <Members list={others} sel={p.editMembers} on={(v) => set({ editMembers: v })} />
          </div>
        </div>
      </Sec>

      {/* Screenshot Permission Control */}
      <Sec icon={<CameraOff size={16} />} title="Screenshot Permission Control">
        <div className="rounded-2xl border border-border bg-surface-hover/40 p-2">
          <Toggle
            on={p.screenshotProtected}
            onChange={(v) => set({ screenshotProtected: v, allowScreenshot: !v })}
            label="Restrict screenshots for this message"
            description="Activates anti-capture blur, clears clipboard on PrintScreen, shows watermark, and notifies participants."
          />
        </div>
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface-hover/30 border border-border/60 p-2.5 text-[11px] text-muted leading-normal">
          <Info size={14} className="shrink-0 text-accent mt-0.5" />
          <span>
            <b>Technical Limitation Notice:</b> Web browsers cannot physically prevent OS-level hardware capture (e.g. Snipping Tool, GPU overlays) or external camera photography. When enabled, Connecta provides active technological deterrents (interception of PrintScreen, window-blur, dynamic watermarking with viewer identity & timestamp, and alert logging).
          </span>
        </div>
      </Sec>

      {/* Reader Capabilities */}
      <Sec icon={<ShieldCheck size={16} />} title="What view-only members may do">
        <div className="rounded-2xl border border-border bg-surface-hover/40 p-1 space-y-0.5">
          <Toggle
            on={p.allowCopy && !p.screenshotProtected}
            onChange={(v) => set({ allowCopy: v })}
            label="Copy text to clipboard"
          />
          <Toggle
            on={p.allowForward}
            onChange={(v) => set({ allowForward: v })}
            label="Forward to other chats"
          />
          <Toggle
            on={p.allowDownload && !p.screenshotProtected}
            onChange={(v) => set({ allowDownload: v })}
            label="Download attachments"
          />
          <Toggle
            on={p.allowReply}
            onChange={(v) => set({ allowReply: v })}
            label="Reply to message"
          />
          <Toggle
            on={p.allowReact}
            onChange={(v) => set({ allowReact: v })}
            label="React with emojis"
          />
        </div>
      </Sec>

      {/* Expiry */}
      <Sec icon={<Clock size={16} />} title="Access expires">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['none', 'Never'],
              ['1h', 'In 1 hour'],
              ['1d', 'In 1 day'],
              ['custom', 'Pick exact time'],
            ] as const
          ).map(([id, l]) => (
            <button
              key={id}
              type="button"
              aria-pressed={p.expiry === id}
              onClick={() => set({ expiry: id })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                p.expiry === id
                  ? 'btn-grad'
                  : 'bg-surface-hover border border-border/80 hover:border-accent/40'
              }`}
            >
              {l}
            </button>
          ))}
          {p.expiry === 'custom' && (
            <input
              type="datetime-local"
              className="field !w-auto !py-1 text-xs mt-1 sm:mt-0"
              value={p.expiresAt ?? ''}
              onChange={(e) => set({ expiresAt: e.target.value })}
            />
          )}
        </div>
      </Sec>

      {/* Actions */}
      <div className="flex justify-between items-center gap-3 pt-3 border-t border-border/60">
        <button
          type="button"
          className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted hover:bg-surface-hover transition"
          onClick={() => setP(DEFAULT_PERM)}
        >
          Reset to default
        </button>
        <button
          type="button"
          className="btn-grad rounded-xl px-5 py-2.5 text-sm font-semibold shadow-premium"
          onClick={() => onSave(p)}
        >
          Save permission settings
        </button>
      </div>
    </Modal>
  );
}

export { Copy, Forward, Download, Reply, SmilePlus };
