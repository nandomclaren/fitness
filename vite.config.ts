import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Em dev, o frontend (vite) e o backend (express) rodam em processos separados;
    // isso encaminha /api pro servidor Express (npm run server:dev) na porta 3001.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      // Caminhos relativos (sem "/" inicial): funcionam tanto na raiz de um domínio
      // próprio quanto em um subcaminho (ex.: GitHub Pages em /fitness/).
      manifest: {
        id: '.',
        lang: 'pt-BR',
        name: 'Sobrecarga - Treino de Musculação',
        short_name: 'Sobrecarga',
        description:
          'Personal trainer digital: registro de cargas, sobrecarga progressiva e resumo pós-treino com mapa muscular.',
        theme_color: '#0b0c10',
        background_color: '#0b0c10',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,gif,webp}'],
        // GIFs de exercícios são grandes: cacheia sob demanda (runtime), não no precache
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/exercises\/gifs\/.*\.(gif|webp|mp4)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
