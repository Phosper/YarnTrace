import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build runs from any sub-path (GitHub Pages, a CDN folder…).
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
  },
});
