/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#534AB7',
          50: '#EEEDF8',
          100: '#D5D2EE',
          200: '#ACA6DD',
          300: '#827ACC',
          400: '#6B62C2',
          500: '#534AB7',
          600: '#423A98',
          700: '#322C73',
          800: '#221E4F',
          900: '#11102A',
        },
        deck: {
          git: '#534AB7',
          programming: '#1D9E75',
          chemistry: '#D85A30',
        },
        terminal: {
          bg: '#1e1e2e',
          fg: '#cdd6f4',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
