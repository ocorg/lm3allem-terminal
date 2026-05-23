import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary:    "var(--primary)",
        secondary:  "var(--secondary)",
        danger:     "var(--danger)",
        success:    "var(--success)",
        warning:    "var(--warning)",
        info:       "var(--info)",
        bg:         "var(--bg)",
        surface:    "var(--surface)",
        "surface-2":"var(--surface-2)",
        border:     "var(--border)",
        text:       "var(--text)",
        "text-muted":"var(--text-muted)",
      },
      spacing: {
        // 8px grid helpers
        "18": "4.5rem",
        "22": "5.5rem",
      },
      borderRadius: {
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
        modal: "250ms",
      },
    },
  },
  plugins: [],
}

export default config