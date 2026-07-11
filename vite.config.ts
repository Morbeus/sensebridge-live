import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the backend over HTTP (REST) and WS.
// In dev we proxy /api and /ws to the Express server so everything
// runs from a single origin (http://localhost:5173).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // allow LAN + tunnel access for multi-device demos
    port: 5173,
    // Cloudflare quick tunnels use random *.trycloudflare.com hosts
    allowedHosts: [".trycloudflare.com", "localhost", ".localhost"],
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
});
