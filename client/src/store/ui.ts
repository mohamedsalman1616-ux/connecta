import { create } from 'zustand';
import type { Msg } from '../lib/types';

export interface Toast {
  id: number;
  msg: string;
  kind: 'info' | 'error' | 'success' | 'warn';
}

export type ActivityTab = 'ALL' | 'VIEW' | 'EDIT' | 'FORWARD' | 'COPY' | 'DOWNLOAD' | 'REPLY' | 'REACT' | 'PERMS';

export type ModalState =
  | null
  | { k: 'settings' }
  | { k: 'newgroup' }
  | { k: 'people' }
  | { k: 'story' }
  | { k: 'notifs' }
  | { k: 'roles' }
  | { k: 'forward'; msg: Msg }
  | { k: 'activity'; msg: Msg; tab?: ActivityTab }
  | { k: 'report'; type: 'user' | 'message'; id: string };

interface U {
  toasts: Toast[];
  toast: (msg: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
  blurred: boolean;
  setBlurred: (b: boolean) => void;
  protectedCount: number;
  addProtected: (n: number) => void;
  modal: ModalState;
  open: (m: ModalState) => void;
  close: () => void;
  panel: boolean;
  setPanel: (b: boolean) => void;
}

let n = 0;

export const useUI = create<U>((set, get) => ({
  toasts: [],
  toast: (msg, kind = 'info') => {
    const id = ++n;
    set({ toasts: [...get().toasts, { id, msg, kind }].slice(-4) });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  blurred: false,
  setBlurred: (blurred) => set({ blurred }),
  protectedCount: 0,
  addProtected: (d) => set({ protectedCount: Math.max(0, get().protectedCount + d) }),
  modal: null,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
  panel: false,
  setPanel: (panel) => set({ panel }),
}));
