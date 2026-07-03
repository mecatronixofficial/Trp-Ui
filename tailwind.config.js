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
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-poppins)', 'sans-serif'],
      },
      boxShadow: {
        ice: '0 4px 24px -4px rgba(28, 166, 209, 0.25)',
      },
    },
  },
  plugins: [],
};
