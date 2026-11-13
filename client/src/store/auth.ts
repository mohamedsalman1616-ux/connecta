import { create } from 'zustand';
import { api } from '../lib/api';
import { applyTheme, getPersistedTheme } from '../lib/themes';
import { closeSocket } from '../lib/socket';
import type { Me } from '../lib/types';

const stored = (): Me | null => {
  try {
    return JSON.parse(sessionStorage.getItem('connecta_user') ?? 'null');
  } catch {
    return null;
  }
};

interface A {
  user: Me | null;
  login: (u: string, p: string, reg?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: Me) => void;
  saveSettings: (s: any) => Promise<void>;
  applyFrom: (u: Me | null) => void;
}

export const useAuth = create<A>((set, get) => ({
  user: stored(),
  applyFrom: u => {
    const s = u?.settings ?? {};
    applyTheme(s.theme ?? getPersistedTheme(), s.accent, s.fontSize);
  },
  setUser: u => {
    sessionStorage.setItem('connecta_user', JSON.stringify(u));
    set({ user: u });
    get().applyFrom(u);
  },
  login: async (username, password, reg) => {
    const r = await api(reg ? '/auth/register' : '/auth/login', { body: { username, password } });
    sessionStorage.setItem('connecta_token', r.token);
    get().setUser(r.user);
  },
  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* token may already be invalid */
    }
    closeSocket();
    sessionStorage.clear();
    set({ user: null });
  },
  saveSettings: async s => {
    const u = get().user!;
    const next = { ...u, settings: { ...u.settings, ...s } };
    get().setUser(next);
    await api('/users/me', { method: 'PATCH', body: { settings: s } });
  },
}));
