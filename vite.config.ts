import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const https = process.env.PIP_HTTPS
  ? { key: readFileSync('.certs/server.key'), cert: readFileSync('.certs/server.crt') }
  : undefined;
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4310,
    strictPort: true,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api': { target: 'http://localhost:4311', ws: true, xfwd: true, changeOrigin: false },
    },
  },
  preview: {
    https,
    host: '0.0.0.0',
    port: 4310,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:4311', ws: true, xfwd: true } },
  },
});
