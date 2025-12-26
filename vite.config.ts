import { defineConfig } from "vite";
import * as path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/** @type {import('vite').UserConfig} */
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({ registerType: "autoUpdate" })],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
