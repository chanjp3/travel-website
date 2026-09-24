import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // share.html: the lightweight read-only itinerary page (no map, no React)
      input: { main: resolve(__dirname, "index.html"), share: resolve(__dirname, "share.html") },
    },
  },
});
