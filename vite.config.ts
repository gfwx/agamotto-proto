import { defineConfig } from "vite";
import * as path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

/** @type {import('vite').UserConfig} */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
