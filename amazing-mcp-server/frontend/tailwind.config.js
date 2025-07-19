/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'surface-topbar': '#171717',
        'surface-sidebar': '#171717',
        'surface-content': '#0F0F0F',
        'surface-overlay': 'rgba(0,0,0,0.60)',
        'content-primary': '#FFFFFF',
        'content-secondary': '#B3B3B3',
        'content-disabled': '#5E5E5E',
        'accent-blue': '#1E88E5',
        'accent-green': '#30D98B',
        'accent-orange': '#FFB74D',
        'accent-red': '#EF5350',
        'border-light': '#262626',
        'border-dark': '#0A0A0A',
        'focus-outset': '#2D9CDB'
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
} 