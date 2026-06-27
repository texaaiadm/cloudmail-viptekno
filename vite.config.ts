import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'https://api.cloudflare.com',
            changeOrigin: true,
            rewrite: (pathValue) => pathValue.replace(/^\/api/, '/client/v4'),
          },
          '/creds': {
            target: 'https://toket.texaproject.com',
            changeOrigin: true,
            rewrite: (pathValue) => pathValue.replace(/^\/creds/, '/'),
          },
        },
      },
      plugins: [
        react(),
        {
          name: 'admin-route-rewrite',
          configureServer(server) {
            server.middlewares.use((req, _res, next) => {
              if (req.url?.startsWith('/admin') && !req.url?.includes('.')) {
                req.url = '/admin.html';
              }
              next();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            admin: path.resolve(__dirname, 'admin.html')
          }
        }
      }
    };
});
