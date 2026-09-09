import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const https = process.env.PIP_HTTPS
  ? { key: readFileSync('.certs/server.key'), cert: readFileSync('.certs/server.crt') }
  : undefined;
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-phone-certificate',
      configurePreviewServer(server) {
        if (!https) return;
        server.middlewares.use('/pip-local-ca.crt', (_request, response) => {
          response.setHeader('Content-Type', 'application/x-x509-ca-cert');
          response.end(readFileSync('.certs/ca.crt'));
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 4310,
    strictPort: true,
    allowedHosts: ['.localhost'],
    proxy: {
      '/api': { target: 'http://127.0.0.1:4311', ws: true, xfwd: true, changeOrigin: false },
    },
  },
  preview: {
    https,
    host: '0.0.0.0',
    port: 4310,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4311', ws: true, xfwd: true } },
  },
});
