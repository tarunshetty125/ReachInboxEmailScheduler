/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        muted: '#8b96a8',
        panel: '#f6f8f7',
        mint: '#e0f7eb',
        green: '#11b64b',
      },
      boxShadow: { soft: '0 8px 26px rgba(30, 41, 59, 0.08)' },
    },
  },
  plugins: [],
};
