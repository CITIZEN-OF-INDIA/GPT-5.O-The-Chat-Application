import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
    base: "./", // 🔥 REQUIRED FOR ELECTRON
  server: {
    port: 5173, // or leave it out if you don't care
    proxy: {
      "/api": {
        target: "http://localhost:4000", // 👈 backend port
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/users": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
