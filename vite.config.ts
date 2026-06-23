/// <reference types="vitest" />
import { defineConfig } from 'vite';

// `base` is only needed for the production Pages build (served under
// /motion-expression/). In dev — locally or in a Codespace — serve from root and
// bind to 0.0.0.0 so the forwarded port URL resolves without a sub-path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/motion-expression/' : '/',
  // host:true binds 0.0.0.0; allowedHosts:true lets a Cloudflare/ngrok tunnel
  // domain reach the dev server (Vite blocks unknown hosts otherwise). Dev only.
  server: { host: true, allowedHosts: true },
  test: { globals: true, environment: 'node' },
}));
