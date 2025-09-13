/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#ff8c35',
          dark: '#ff7a14',
          light: '#ffb176',
        },
      },
    },
  },
  plugins: [],
}


