/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Served from https://cloudcodetree.github.io/motion-expression/
  base: '/motion-expression/',
  test: { globals: true, environment: 'node' },
});
