export interface Theme {
  id: 'light' | 'dark';
  name: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  b1: string;
  b2: string;
  surfaceHover: string;
  border: string;
  cardBg: string;
}

const T = (
  id: 'light' | 'dark',
  name: string,
  bg: string,
  surface: string,
  ink: string,
  muted: string,
  accent: string,
  accent2: string,
  b1: string,
  b2: string,
  surfaceHover: string,
  border: string,
  cardBg: string
): Theme => ({
  id,
  name,
  bg,
  surface,
  ink,
  muted,
  accent,
  accent2,
  b1,
  b2,
  surfaceHover,
  border,
  cardBg,
});

// Royal Elegance: Soft White (#F8F7FC), Lavender (#E9E2FA), Soft Purple (#A78BFA), Royal Purple (#6546B8)
export const THEMES: Theme[] = [
  T(
    'light',
    'Light Mode',
    '#F8F7FC',
    '#FFFFFF',
    '#1E1733',
    '#696082',
    '#6546B8',
    '#A78BFA',
    '#6546B8',
    '#8B6EE8',
    '#E9E2FA',
    '#DDD5F3',
    '#E9E2FA'
  ),
  T(
    'dark',
    'Dark Mode',
    '#0E0D12',
    '#16141C',
    '#F4F2FA',
    '#9F97B8',
    '#A78BFA',
    '#6546B8',
    '#6546B8',
    '#8B6EE8',
    '#262233',
    '#2E2940',
    '#1D1A26'
  ),
];

export const WALLPAPERS = [
  { id: 'none', name: 'None', css: '' },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    css: 'radial-gradient(ellipse at 20% 50%, rgba(167,139,250,0.09), transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(101,70,184,0.07), transparent 60%)',
  },
  {
    id: 'royal-silk',
    name: 'Royal Silk',
    css: 'linear-gradient(150deg, rgba(233,226,250,0.35), rgba(167,139,250,0.08))',
  },
  {
    id: 'subtle-grid',
    name: 'Subtle Lines',
    css: 'repeating-linear-gradient(0deg, transparent, transparent 32px, rgba(101,70,184,0.04) 32px, rgba(101,70,184,0.04) 33px)',
  },
  {
    id: 'velvet',
    name: 'Velvet',
    css: 'radial-gradient(circle at 30% 70%, rgba(101,70,184,0.08), transparent 50%), radial-gradient(circle at 70% 30%, rgba(167,139,250,0.08), transparent 50%)',
  },
];

const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
};

export function getPersistedTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('connecta_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(id: string, _custom?: string, fontSize?: string) {
  const chosenId: 'light' | 'dark' = id === 'dark' ? 'dark' : 'light';
  const t = THEMES.find((x) => x.id === chosenId) ?? THEMES[0];
  const s = document.documentElement.style;

  s.setProperty('--bg', t.bg);
  s.setProperty('--c-surface', rgb(t.surface));
  s.setProperty('--c-ink', rgb(t.ink));
  s.setProperty('--c-muted', rgb(t.muted));
  s.setProperty('--c-accent', rgb(t.accent));
  s.setProperty('--c-accent2', rgb(t.accent2));
  s.setProperty('--b1', t.b1);
  s.setProperty('--b2', t.b2);
  s.setProperty('--c-surface-hover', rgb(t.surfaceHover));
  s.setProperty('--c-border', rgb(t.border));
  s.setProperty('--c-card', rgb(t.cardBg));

  document.documentElement.setAttribute('data-theme', chosenId);
  s.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';

  try {
    localStorage.setItem('connecta_theme', chosenId);
  } catch {
    // Ignore localStorage access errors
  }
}
