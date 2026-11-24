/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Quicksand', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1E3A5F',
          dark: '#16304D',
          light: '#2C5282',
        },
        accent: {
          DEFAULT: '#E8833A',
          dark: '#C25E17',
          light: '#FDECE0',
        },
        surface: '#F6F7FB',
      },
    },
  },
  plugins: [],
};

