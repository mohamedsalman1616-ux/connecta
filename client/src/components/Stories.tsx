import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Eye, Trash2 } from 'lucide-react';
import { api, fileUrl, avatarUrl } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { Avatar } from './Avatar';

interface Grp {
  user: { id: string; username: string; displayName: string };
  stories: any[];
}

export const storyBus = { reload: () => {} };

export function StoriesBar() {
  const me = useAuth((s) => s.user)!;
  const open = useUI((s) => s.open);
  const [data, setData] = useState<Grp[] | null>(null);
  const [view, setView] = useState<Grp | null>(null);

  const load = () =>
    api<Grp[]>('/stories')
      .then(setData)
      .catch(() => setData([]));

  useEffect(() => {
    storyBus.reload = load;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const mine = data?.find((g) => g.user.id === me.id);
  const others = (data ?? []).filter((g) => g.user.id !== me.id);
  const ring = (g: Grp) => (g.stories.every((s) => s.viewed) ? 'ring-white/30' : 'ring-[#A78BFA]');

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-3.5 pb-2.5 pt-0.5 select-none" aria-label="Stories">
        {/* Your Story */}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <button
              aria-label={mine ? 'View your story' : 'Add story'}
              onClick={() => (mine ? setView(mine) : open({ k: 'story' }))}
              className={`rounded-full p-[2px] ring-2 transition-transform hover:scale-105 ${
                mine ? ring(mine) : 'ring-white/30'
              }`}
            >
              <Avatar name={me.displayName || me.username} size={44} src={avatarUrl(me.id)} />
            </button>
            <button
              aria-label="Create story"
              onClick={() => open({ k: 'story' })}
              className="btn-grad absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-[#4A3194] text-white"
            >
              <Plus size={11} />
            </button>
          </div>
          <span className="w-full truncate text-center text-[10px] text-[#E9E2FA]/85 font-medium">Your story</span>
        </div>

        {/* Contacts' Stories */}
        {others.map((g) => (
          <button
            key={g.user.id}
            onClick={() => setView(g)}
            className="flex w-14 shrink-0 flex-col items-center gap-1 transition-transform hover:scale-105"
          >
            <span className={`rounded-full p-[2px] ring-2 ${ring(g)}`}>
              <Avatar
                name={g.user.displayName || g.user.username}
                size={44}
                src={avatarUrl(g.user.id)}
              />
            </span>
            <span className="w-full truncate text-center text-[10px] text-[#E9E2FA]/85 font-medium">
              {g.user.displayName || g.user.username}
            </span>
          </button>
        ))}

        {data && !others.length && !mine && (
          <p className="self-center text-[11px] text-[#E9E2FA]/70 pl-2">
            Stories from your contacts appear here for 24 hours.
          </p>
        )}
      </div>

      <AnimatePresence>
        {view && (
          <Viewer
            g={view}
            mine={view.user.id === me.id}
            onClose={() => {
              setView(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Viewer({
  g,
  mine,
  onClose,
}: {
  g: Grp;
  mine: boolean;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const s = g.stories[i];
  const toast = useUI((u) => u.toast);
  const next = () => (i + 1 < g.stories.length ? setI(i + 1) : onClose());

  useEffect(() => {
    api(`/stories/${s.id}/view`, { method: 'POST', body: {} }).catch(() => {});
    const isVideo = (s.mediaMime ?? '').startsWith('video/');
    if (isVideo) return;
    const t = setTimeout(next, 5000);
    return () => clearTimeout(t);
  }, [i]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') setI(Math.max(0, i - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [i]);

  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/92 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden sm:h-[90vh] sm:rounded-3xl shadow-premium-lg"
        style={{ background: s.bg ?? '#16141C' }}
      >
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-2.5">
          {g.stories.map((_, j) => (
            <div key={j} className="h-1 flex-1 overflow-hidden rounded bg-white/30">
              <motion.div
                key={`${i}-${j}`}
                className="h-full bg-white"
                initial={{ width: j < i ? '100%' : 0 }}
                animate={{ width: j <= i ? '100%' : 0 }}
                transition={{ duration: j === i ? 5 : 0, ease: 'linear' }}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 top-6 z-10 flex items-center gap-2.5 px-3.5 text-white">
          <Avatar
            name={g.user.displayName || g.user.username}
            size={34}
            src={avatarUrl(g.user.id)}
          />
          <span className="flex-1 text-xs font-bold text-white drop-shadow-sm">
            {g.user.displayName || g.user.username}
          </span>
          {mine && (
            <button
              aria-label="Delete story"
              onClick={() =>
                api(`/stories/${s.id}`, { method: 'DELETE' }).then(() => {
                  toast('Story deleted', 'success');
                  onClose();
                })
              }
              className="p-1 hover:text-rose-400 transition"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button aria-label="Close story" onClick={onClose} className="p-1 hover:text-white/70 transition">
            <X size={20} />
          </button>
        </div>

        <div
          className="grid flex-1 place-items-center cursor-pointer select-none"
          onClick={(e) =>
            e.clientX - e.currentTarget.getBoundingClientRect().left <
            e.currentTarget.clientWidth / 3
              ? setI(Math.max(0, i - 1))
              : next()
          }
        >
          {s.hasMedia &&
            ((s.mediaMime ?? '').startsWith('video/') ? (
              <video
                key={s.id}
                src={fileUrl(`/api/stories/${s.id}/media`)}
                autoPlay
                onEnded={next}
                className="max-h-full max-w-full"
              />
            ) : (
              <img
                key={s.id}
                src={fileUrl(`/api/stories/${s.id}/media`)}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ))}
          {s.text && (
            <p className="display absolute inset-x-6 text-center text-xl font-bold text-white drop-shadow-md leading-snug">
              {s.text}
            </p>
          )}
        </div>

        {mine && (
          <p className="flex items-center justify-center gap-1.5 p-3 text-xs text-white/80 bg-black/30 backdrop-blur-sm">
            <Eye size={14} />
            {s.viewerCount ?? 0} views
          </p>
        )}
      </div>
    </motion.div>
  );
}
