/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F17',
          surface: '#111827',
          card: '#161F30',
          border: '#1F293D',
          hover: '#1E293B',
          text: '#F3F4F6',
          muted: '#94A3B8',
        },
        brand: {
          emerald: '#10B981',
          'emerald-light': '#34D399',
          'emerald-dark': '#059669',
          blue: '#0EA5E9',
          'blue-light': '#38BDF8',
          amber: '#F59E0B',
          red: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
