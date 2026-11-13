import { useEffect, useState } from 'react';
import { useUI } from '../store/ui';
import { api } from './api';

export const useNow = (ms: number) => {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
};

export const fmtTime = (d: string | number) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const fmtDay = (d: string) => {
  const x = new Date(d),
    t = new Date();
  return x.toDateString() === t.toDateString()
    ? 'Today'
    : x.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

export const ago = (d?: string) => {
  if (!d) return 'a while ago';
  const m = Math.round((Date.now() - +new Date(d)) / 60000);
  return m < 1
    ? 'just now'
    : m < 60
    ? `${m} min ago`
    : m < 1440
    ? `${Math.round(m / 60)} h ago`
    : new Date(d).toLocaleDateString();
};

/**
 * Screenshot and confidential message protection deterrents.
 * Active whenever protected messages or conversations are displayed.
 * NOTE: Modern web browsers and OS platforms cannot physically prevent hardware screen capture,
 * external cameras, or OS-level screen grabbers. These active deterrents provide immediate
 * obstruction, clipboard clearance, tab-switch blurs, and audit notification alerts.
 */
export function useProtectionGuards(activeMessageId?: string) {
  const count = useUI((s) => s.protectedCount);
  const { setBlurred, toast } = useUI();

  useEffect(() => {
    if (!count) {
      setBlurred(false);
      return;
    }

    const hide = () => setBlurred(true);
    const show = () => {
      if (useUI.getState().blurred) {
        toast('Returned to window. Protected messages were hidden while this tab was out of focus.', 'warn');
        setBlurred(false);
      }
    };
    const vis = () => (document.hidden ? hide() : show());

    const notifyServer = () => {
      if (activeMessageId) {
        api(`/messages/${activeMessageId}/screenshot-alert`, { method: 'POST', body: {} }).catch(() => {});
      }
    };

    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Intercept PrintScreen
      if (k === 'printscreen' || e.code === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {});
        setBlurred(true);
        toast('⚠️ Screenshot attempt detected! Protected messages have been hidden. Notice sent to chat participants.', 'warn');
        notifyServer();
        setTimeout(() => setBlurred(false), 2000);
      }
      // Intercept Print, Save, Screen Grab key combos
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(k)) {
        e.preventDefault();
        toast('Printing and saving are disabled while protected content is on screen.', 'warn');
      }
      // Intercept macOS Cmd+Shift+3/4/5
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        setBlurred(true);
        toast('⚠️ Screen capture shortcut detected. Protected messages hidden.', 'warn');
        notifyServer();
        setTimeout(() => setBlurred(false), 2000);
      }
    };

    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);

    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    };
  }, [count, setBlurred, toast, activeMessageId]);
}

export function beep(vol = 0.4) {
  try {
    const c = new AudioContext(),
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = 880;
    g.gain.value = vol * 0.15;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.12);
  } catch {
    /* audio unavailable */
  }
}
