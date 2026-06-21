/// <reference types="vitest" />
import { defineConfig } from 'vite';

// `base` is only needed for the production Pages build (served under
// /motion-expression/). In dev — locally or in a Codespace — serve from root and
// bind to 0.0.0.0 so the forwarded port URL resolves without a sub-path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/motion-expression/' : '/',
  server: { host: true },
  test: { globals: true, environment: 'node' },
}));
