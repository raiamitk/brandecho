import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:      "#141414",  // main background
          surface: "#1c1c1c",  // cards/panels
          border:  "#2a2a2a",  // borders
          accent:  "#00FF96",  // primary accent (neon green)
          "accent-dim": "#00cc78", // darker accent for hover
          muted:   "#888888",  // muted text
        },
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-in-out",
        "slide-left": "slideLeft 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideLeft: { "0%": { transform: "translateX(20px)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
        pulseSoft: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
      },
    },
  },
  plugins: [],
};

export default config;
