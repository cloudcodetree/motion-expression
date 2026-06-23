/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import { appendFileSync } from 'node:fs';

// Dev-only structured telemetry sink. The app (incl. a phone over the tunnel)
// POSTs JSON events to /__telemetry; we append each to .dev-telemetry.jsonl and
// echo a one-line summary to the dev console. Persistent + queryable, and a
// clean upgrade path to an OpenTelemetry exporter once a backend exists.
function devTelemetry(): Plugin {
  return {
    name: 'dev-telemetry',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__telemetry', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const ev = JSON.parse(body);
            appendFileSync('.dev-telemetry.jsonl', JSON.stringify(ev) + '\n');
            const extra = ev.summary ?? ev.error ?? '';
            console.log(`[tele] ${ev.sid ?? '?'} ${ev.type}${extra ? ' — ' + extra : ''}`);
          } catch {
            console.log('[tele:unparsed]', body.slice(0, 200));
          }
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
  plugins: [devTelemetry()],
  test: { globals: true, environment: 'node' },
}));
