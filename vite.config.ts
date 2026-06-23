/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';

// Dev-only: lets the app (e.g. on a phone via the tunnel) POST diagnostics text
// to /__log, which prints to the dev-server console. Removes the need to
// screenshot on-device numbers during debugging. Never runs in the prod build.
function devLog(): Plugin {
  return {
    name: 'dev-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__log', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          console.log(`\n──[PHONE]──────────────\n${body}\n───────────────────────\n`);
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

// `base` is only needed for the production Pages build (served under
// /motion-expression/). In dev — locally or in a Codespace — serve from root and
// bind to 0.0.0.0 so the forwarded port URL resolves without a sub-path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/motion-expression/' : '/',
  // host:true binds 0.0.0.0; allowedHosts:true lets a Cloudflare/ngrok tunnel
  // domain reach the dev server (Vite blocks unknown hosts otherwise). Dev only.
  server: { host: true, allowedHosts: true },
  plugins: [devLog()],
  test: { globals: true, environment: 'node' },
}));
