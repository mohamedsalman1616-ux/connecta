const c = (n) => `rgb(var(--c-${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: c('surface'),
        ink: c('ink'),
        muted: c('muted'),
        accent: c('accent'),
        accent2: c('accent2'),
        'surface-hover': c('surface-hover'),
        border: c('border'),
        card: c('card'),
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgb(var(--c-ink) / 0.06)',
        'premium-lg': '0 12px 40px -4px rgb(var(--c-ink) / 0.12)',
      }
    },
  },
  plugins: [],
};
