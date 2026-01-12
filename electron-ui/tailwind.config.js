/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Outfit"', 'serif'], // Closest looking for Claude serif style
        sans: ['"Outfit"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
