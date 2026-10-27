import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production: tắt source map, bỏ console và debugger (theo mục Bảo mật của Linko Design System).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 600,
  },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,
}));
