import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/eth/",
  plugins: [react()],
  define: { global: "globalThis" },
  resolve: { dedupe: ["react", "react-dom"] },
  build: { outDir: "dist" },
  server: { port: 5174 },
});
