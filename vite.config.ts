import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fleet-api-middleware',
      async configureServer(server) {
        const { createApp } = await import('./src/server/app.ts');
        const apiApp = createApp();
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api')) {
            apiApp(req as any, res as any, next);
          } else {
            next();
          }
        });
      },
    },
  ],
});
