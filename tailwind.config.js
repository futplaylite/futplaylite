/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rosalia: {
          green: '#126B46',
          'green-dark': '#0D4F33',
          'green-light': '#188B5B',
          gold: '#C9A227',
          'gold-light': '#E2BF4A',
          'gold-dark': '#9E7D18',
          graphite: '#17231D',
          'graphite-light': '#21322A',
          'graphite-dark': '#0E1612',
          white: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Oswald', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
