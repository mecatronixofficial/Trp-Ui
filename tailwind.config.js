/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        iceblue: {
          50: '#f0fbff',
          100: '#dff5fd',
          200: '#b9eaf9',
          300: '#82d9f2',
          400: '#43c1e6',
          500: '#1ca6d1',
          600: '#1284ac',
          700: '#136a8b',
          800: '#175872',
          900: '#184a5f',
        },
        navy: {
          800: '#0f2b3d',
          900: '#0a1c2a',
        },
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
        },
      },
      fontFamily: {
        // Single sans-serif family across the app. `display` is kept as an
        // alias (rather than removed) so the ~50 existing `font-display`
        // heading classes don't need to be touched one by one.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        ice: '0 4px 24px -4px rgba(28, 166, 209, 0.25)',
      },
      keyframes: {
        frostFall: {
          '0%': { transform: 'translateY(-8%)', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { transform: 'translateY(112vh)', opacity: '0' },
        },
        iceFloat: {
          '0%, 100%': { transform: 'translateY(0px) rotate(var(--ice-rotate, 0deg))' },
          '50%': { transform: 'translateY(-16px) rotate(var(--ice-rotate, 0deg))' },
        },
        auroraDrift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(-4%, 5%, 0) scale(1.1)' },
        },
        crystalDrift: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) translateX(6px) rotate(12deg)' },
        },
      },
      animation: {
        'frost-fall': 'frostFall 9s linear infinite',
        'ice-float': 'iceFloat 5s ease-in-out infinite',
        'aurora-drift': 'auroraDrift 16s ease-in-out infinite',
        'aurora-drift-slow': 'auroraDrift 22s ease-in-out infinite reverse',
        'crystal-drift': 'crystalDrift 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
