import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/** Where `wrangler dev` listens. Only used as a dev-time proxy target. */
const WORKER = 'http://127.0.0.1:8787';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Exposed on the LAN so a real phone can be tested against, which is the
    // primary target. Note: getUserMedia and WebXR both need a secure context.
    // localhost counts as secure, a LAN IP does not — so phone testing needs
    // https (or a tunnel) before voice will work off-machine.
    host: true,
    // Proxy the API so the browser always talks to its own origin, in dev and in
    // production alike. Previously the client hardcoded the worker's port, which
    // meant a CORS surface, a second URL to keep in sync, and an opaque "Failed
    // to fetch" whenever the worker was not up. `ws: true` matters — the room
    // connection is a WebSocket upgrade.
    proxy: {
      '/api': {
        target: WORKER,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
