import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Lock,
  User as UserI,
  ShieldCheck,
  Zap,
  Layers,
  Sun,
  Moon,
  CameraOff,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { applyTheme, getPersistedTheme } from '../lib/themes';

const DEMO = [
  'manager',
  'gm1',
  'gm2',
  'tl1',
  'tl2',
  'staff1',
  'staff2',
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const toast = useUI((s) => s.toast);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [reg, setReg] = useState(false);
  const [busy, setBusy] = useState(false);

  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(getPersistedTheme());

  if (user) return <Navigate to="/" replace />;

  const go = async (name: string, pass: string, r = false) => {
    setBusy(true);
    try {
      await login(name, pass, r);
      nav('/', { replace: true });
    } catch (e: any) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  const toggleTheme = () => {
    const next: 'light' | 'dark' = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(next);
    applyTheme(next, undefined, undefined);
  };

  return (
    <div className="grid h-full overflow-y-auto lg:grid-cols-2 bg-gradient-to-br from-[#F8F7FC] to-[#E9E2FA] dark:from-[#0E0D12] dark:to-[#16141C]">
      {/* Left Hero Section (Desktop) */}
      <div className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center justify-between">
          <div className="display text-2xl font-bold tracking-tight text-accent flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent shadow-sm">
              ✦
            </span>
            Connecta
          </div>
          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="rounded-full border border-border bg-surface/80 p-2.5 text-muted hover:text-ink hover:bg-surface transition shadow-sm"
            aria-label="Toggle theme"
            title={currentTheme === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          >
            {currentTheme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-accent" />}
          </button>
        </div>

        <div>
          <h1 className="display max-w-lg text-5xl font-extrabold leading-[1.08] text-ink tracking-tight">
            Sophisticated chat with{' '}
            <span className="bg-gradient-to-r from-[var(--b1)] to-[var(--b2)] bg-clip-text text-transparent">
              granular permissions
            </span>
            .
          </h1>
          <p className="mt-5 max-w-md text-base text-muted leading-relaxed font-normal">
            Where every message carries its own rules for who can view, edit, download, and copy — now with active screenshot restriction controls and flexible role hierarchies.
          </p>
        </div>

        <ul className="space-y-3.5 text-xs text-muted font-medium">
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent">
              <ShieldCheck size={16} />
            </span>
            <span>Server-enforced audience and permission rules</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent">
              <CameraOff size={16} />
            </span>
            <span>Screenshot protection & anti-capture deterrence controls</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent">
              <Layers size={16} />
            </span>
            <span>Roles: Manager, General Manager, Team Leader, Staff & Custom Roles</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent">
              <Zap size={16} />
            </span>
            <span>Refined Light & Dark themes in Royal Elegance</span>
          </li>
        </ul>
      </div>

      {/* Right Login / Sign-up Card */}
      <div className="grid place-items-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass w-full max-w-md rounded-3xl p-8 shadow-premium-lg border border-border/80 bg-surface/95"
        >
          {/* Mobile header */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <span className="display text-xl font-bold text-accent">✦ Connecta</span>
            <button
              onClick={toggleTheme}
              className="rounded-full border border-border p-2 text-muted hover:text-ink transition"
              aria-label="Toggle theme"
            >
              {currentTheme === 'light' ? <Moon size={16} /> : <Sun size={16} className="text-accent" />}
            </button>
          </div>

          <h2 className="display mb-1 text-2xl font-bold text-ink tracking-tight">
            {reg ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mb-6 text-xs text-muted leading-relaxed">
            Sign in to your organization workspace. Multiple sessions per tab are supported.
          </p>

          <div className="space-y-3">
            <div className="relative">
              <UserI size={16} className="absolute left-3 top-3.5 text-muted" />
              <input
                className="field !pl-9 text-xs"
                placeholder="Username (e.g. manager, gm1, staff1)"
                aria-label="Username"
                autoComplete="username"
                value={u}
                onChange={(e) => setU(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3.5 text-muted" />
              <input
                className="field !pl-9 text-xs"
                type="password"
                placeholder="Password"
                aria-label="Password"
                autoComplete={reg ? 'new-password' : 'current-password'}
                value={p}
                onChange={(e) => setP(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && go(u, p, reg)}
              />
            </div>
            <button
              disabled={busy || !u || !p}
              className="btn-grad w-full rounded-xl py-3 text-xs font-semibold uppercase tracking-wider shadow-premium disabled:opacity-50"
              onClick={() => go(u, p, reg)}
            >
              {busy ? 'Please wait…' : reg ? 'Create Account' : 'Sign In'}
            </button>
          </div>

          <button
            className="mt-4 w-full text-center text-xs text-muted hover:text-accent font-medium transition"
            onClick={() => setReg(!reg)}
          >
            {reg ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>

          {/* Quick Demo Sign-in with New Roles */}
          {import.meta.env.VITE_DEMO_MODE === 'true' && (
            <div className="mt-6 border-t border-border/70 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Demo Accounts (Password: demo123)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO.map((d) => (
                  <button
                    key={d}
                    disabled={busy}
                    onClick={() => go(d, 'demo123')}
                    className="rounded-full border border-border bg-surface-hover/60 px-3 py-1 text-xs font-medium text-ink hover:border-accent hover:bg-accent/10 transition"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
