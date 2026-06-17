/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Pretendard",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "system-ui",
          "sans-serif"
        ]
      },
      colors: {
        ink: "#17202a",
        slateLine: "#d8dee8",
        paper: "#f5f7fb",
        collagen: "#c2410c",
        uva: "#2563eb",
        uvb: "#b45309",
        uvc: "#be123c"
      }
    }
  },
  plugins: []
};
