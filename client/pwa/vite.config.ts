import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/(alerts|safe-spaces|recommendations)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'haven-api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 6 }, // 6h
            },
          },
        ],
      },
      manifest: {
        name: 'Haven — Emergency Response',
        short_name: 'Haven',
        description: 'AI-powered bushfire preparedness and evacuation assistant',
        theme_color: '#b91c1c',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
