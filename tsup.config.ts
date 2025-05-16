import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server.ts'],
  format: ['esm'],
  target: 'es2020',
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  clean: true,
});
