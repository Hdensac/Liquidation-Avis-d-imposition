import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          blue: "#1e3a8a",
          dark: "#111827",
          gray: "#374151",
          light: "#f9fafb",
        },
      },
    },
  },
  plugins: [],
};
export default config;
