import { ReactNode, useEffect, useMemo } from 'react';
import { CameraOff, ShieldAlert } from 'lucide-react';
import { useUI } from '../store/ui';
import { useAuth } from '../store/auth';
import { useNow } from '../lib/hooks';
import type { Msg } from '../lib/types';

/**
 * Wraps protected and screenshot-restricted content:
 * - Dynamic per-user watermark
 * - Automatic blur when window focus is lost or screenshot keys are pressed
 * - Disabled selection, copy, context-menu, and drag
 * 
 * NOTE: As documented, browsers cannot truly block OS-level hardware screen capture or physical cameras.
 * This is an active technological deterrent and notification layer.
 */
export function Protected({ msg, children }: { msg: Msg; children: ReactNode }) {
  const me = useAuth((s) => s.user)!;
  const { blurred, addProtected, toast } = useUI();
  const now = useNow(30000);

  const isRestrictedAudience = msg.perm?.viewMode === 'custom' || msg.can.restricted;
  const isScreenshotRestricted = msg.can.screenshotProtected || msg.can.allowScreenshot === false;
  const cannotCopy = !msg.can.copy;

  const requiresProtection = isRestrictedAudience || isScreenshotRestricted || cannotCopy;

  useEffect(() => {
    if (!requiresProtection) return;
    addProtected(1);
    return () => addProtected(-1);
  }, [requiresProtection, addProtected]);

  // Dynamic user watermark with username, role, and current timestamp
  const bg = useMemo(() => {
    const formattedDate = new Date(now).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const text = `${me.username} (${me.role}) · ${formattedDate}`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='90'><text x='10' y='55' transform='rotate(-18 130 45)' font-family='sans-serif' font-size='11' font-weight='600' fill='rgba(139,105,20,0.18)'>${text.replace(
      /&/g,
      '&amp;'
    ).replace(/</g, '&lt;')}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [me.username, me.role, now]);

  if (!requiresProtection) return <>{children}</>;

  const handleActionBlocked = (e: React.SyntheticEvent, action: string) => {
    if (cannotCopy || isScreenshotRestricted) {
      e.preventDefault();
      toast(`${action} is restricted on this protected message.`, 'warn');
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${cannotCopy ? 'protected' : ''}`}
      onContextMenu={(e) => handleActionBlocked(e, 'Right-click menu')}
      onCopy={(e) => handleActionBlocked(e, 'Copying')}
      onCut={(e) => handleActionBlocked(e, 'Cutting')}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Content blurred when window is out of focus or screenshot hotkey triggered */}
      <div className={`transition duration-150 ${blurred ? 'pointer-events-none blur-xl select-none' : ''}`}>
        {children}
      </div>

      {/* Dynamic Watermark overlay */}
      {(isRestrictedAudience || isScreenshotRestricted) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{ backgroundImage: bg }}
        />
      )}

      {/* Blurred security placeholder */}
      {blurred && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 backdrop-blur-md p-3 text-center text-xs font-semibold text-white">
          <div className="flex flex-col items-center gap-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-accent">
              <CameraOff size={16} />
            </div>
            <span>Protected Content Hidden</span>
            <span className="text-[10px] font-normal text-white/80 max-w-[200px]">
              Return focus to this tab to resume view. Screenshots are logged.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
