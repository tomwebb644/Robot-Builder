import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: true
  },
  preview: {
    port: 5183,
    strictPort: true
  },
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@state': path.resolve(__dirname, 'src/state'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@styles': path.resolve(__dirname, 'src/styles')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
