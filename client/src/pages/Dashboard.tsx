import {
  MessagesSquare,
  Users,
  Bell,
  Plus,
  UserPlus,
  Sparkles,
  ShieldCheck,
  CameraOff,
  Shield,
  Info,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useChat } from '../store/chat';
import { useUI } from '../store/ui';

export default function Dashboard() {
  const me = useAuth((s) => s.user)!;
  const { chats, unreadNotifs } = useChat();
  const open = useUI((s) => s.open);
  const unread = chats.reduce((a, c) => a + c.unread, 0);
  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const Stat = ({
    i,
    n,
    l,
  }: {
    i: React.ReactNode;
    n: number;
    l: string;
  }) => (
    <div className="glass-card rounded-2xl p-4.5 border border-border/80 shadow-premium hover:border-accent/40 transition">
      <div className="mb-2.5 grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
        {i}
      </div>
      <p className="display text-3xl font-extrabold text-ink">{n}</p>
      <p className="text-xs text-muted font-medium mt-0.5">{l}</p>
    </div>
  );

  const isManager = me.role === 'Manager';

  return (
    <div className="hidden flex-1 overflow-y-auto p-8 md:block">
      <div className="mx-auto max-w-3xl space-y-7">
        {/* Welcome Banner */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {greeting}
          </p>
          <h2 className="display text-3xl font-extrabold text-ink tracking-tight mt-1">
            {me.displayName || me.username},
            <span className="text-muted font-normal text-2xl block mt-1">
              You are signed in as{' '}
              <span className="rounded-full bg-accent/15 border border-accent/25 px-2.5 py-0.5 text-accent font-bold text-lg inline-block">
                {me.role}
              </span>
            </span>
          </h2>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3.5">
          <Stat i={<MessagesSquare size={18} />} n={unread} l="Unread messages" />
          <Stat
            i={<Users size={18} />}
            n={chats.filter((c) => c.type === 'group').length}
            l="Active groups"
          />
          <Stat i={<Bell size={18} />} n={unreadNotifs} l="Notifications" />
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            className="btn-grad flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-premium"
            onClick={() => open({ k: 'newgroup' })}
          >
            <Plus size={16} />
            New Group Channel
          </button>
          <button
            className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-ink hover:bg-surface-hover border border-border transition"
            onClick={() => open({ k: 'people' })}
          >
            <UserPlus size={16} className="text-accent" />
            Find People
          </button>
          <button
            className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-ink hover:bg-surface-hover border border-border transition"
            onClick={() => open({ k: 'story' })}
          >
            <Sparkles size={16} className="text-accent" />
            Post Story
          </button>
          {isManager && (
            <button
              className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-accent hover:bg-accent/10 border border-accent/30 transition"
              onClick={() => open({ k: 'roles' })}
            >
              <Shield size={16} />
              Manage Roles & Permissions
            </button>
          )}
        </div>

        {/* Informational Guidance Cards */}
        <div className="space-y-3.5">
          {/* Protected Messages Card */}
          <div className="glass-card rounded-2xl p-5 border border-border/80 shadow-premium">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-sm text-ink">
              <ShieldCheck size={18} className="text-accent" />
              Granular Message Permissions
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              In any group, click the shield icon in the message composer to restrict who can view and edit your message. Payloads are filtered directly on the backend — non-recipients never receive the message data. View-only readers are blocked from copying, forwarding, or downloading attachments.
            </p>
          </div>

          {/* Screenshot Permission Control Card */}
          <div className="glass-card rounded-2xl p-5 border border-border/80 shadow-premium">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-sm text-ink">
              <CameraOff size={18} className="text-accent" />
              Screenshot Permission Controls & Best-Effort Protection
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Protected messages activate an anti-capture deterrent layer: dynamic user watermarks with identity & timestamp, immediate blurring on window focus loss, and detection of screen capture shortcuts (such as PrintScreen or macOS screenshot keys).
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-accent/10 border border-accent/20 p-2.5 text-[11px] text-ink/80 leading-normal">
              <Info size={15} className="text-accent shrink-0 mt-0.5" />
              <span>
                <b>Browser & Device Limitation:</b> Web browsers cannot physically prevent OS-level hardware screen capture or external cameras. Connecta provides active software deterrents, clipboard clearance, and audit notifications to discourage unauthorized redistribution.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
