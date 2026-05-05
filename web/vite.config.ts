// web/vite.config.ts
// ---------------------------------------------------------------------------
// Vite build + dev-server configuration.
// The proxy section routes all /api/* requests from the browser to the
// Express server on port 5177, keeping the API token out of the browser.
// ---------------------------------------------------------------------------

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5176,

    proxy: {
      // Any request the browser makes to /api/* is forwarded to Express.
      // Think of this as a mailroom redirect — the browser sends to one
      // address, but the letter actually lands somewhere else.
      "/api": {
        target: "http://localhost:5177",
        changeOrigin: true,
        // Helpful during development — logs every proxied request
        configure: (proxy) => {
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log(`[vite-proxy] ${req.method} ${req.url}`);
          });
        },
      },
    },
  },
});
