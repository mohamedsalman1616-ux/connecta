import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { useUI } from '../store/ui';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-end bg-black/45 backdrop-blur-[3px] p-0 sm:place-items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className={`glass flex max-h-[92vh] w-full flex-col rounded-t-3xl sm:rounded-3xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        } bg-surface/95 shadow-premium-lg border border-border/80`}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 pb-3.5 pt-5">
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-muted hover:bg-surface-hover hover:text-ink transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6 pt-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useUI();
  const c = {
    info: 'border-accent/60 bg-surface/95 text-ink',
    error: 'border-rose-500 bg-surface/95 text-ink',
    success: 'border-emerald-500 bg-surface/95 text-ink',
    warn: 'border-amber-600 bg-surface/95 text-ink',
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => dismiss(t.id)}
            className={`glass pointer-events-auto max-w-md cursor-pointer rounded-2xl border-l-4 px-4 py-3 text-sm shadow-premium ${
              c[t.kind]
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const Spinner = () => (
  <div className="grid place-items-center p-8">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
  </div>
);

export const Empty = ({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) => (
  <div className="grid place-items-center gap-2.5 p-8 text-center text-muted">
    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
      {icon}
    </div>
    <p className="font-semibold text-ink text-base">{title}</p>
    {hint && <p className="max-w-xs text-sm leading-relaxed text-muted">{hint}</p>}
  </div>
);

export const Toggle = ({
  on,
  onChange,
  label,
  description,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm hover:bg-surface-hover/70 transition"
  >
    <div className="pr-3">
      <span className="font-medium text-ink block">{label}</span>
      {description && <span className="text-xs text-muted block mt-0.5">{description}</span>}
    </div>
    <span
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        on ? 'btn-grad' : 'bg-border'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </span>
  </button>
);
