/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        gray: {
          950: '#0a0a0f',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':  'fadeIn 0.25s ease-in-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                                        to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateY(-8px)', opacity: '0' },         to: { transform: 'translateY(0)',     opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.96)',      opacity: '0' },         to: { transform: 'scale(1)',          opacity: '1' } },
      },
    },
  },
  plugins: [],
};
