/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#13b6ec",
        "background-light": "#f6f8f8",
        "background-dark": "#101d22",
        "content-light": "#f0f3f4",
        "content-dark": "#1a2a31",
        "text-light": "#111618",
        "text-dark": "#e8eaeb",
        "subtext-light": "#617f89",
        "subtext-dark": "#a0b1b8",
      },
      fontFamily: {
        display: ["Inter", "Noto Sans TC", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
}