import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Cuando se despliega en GitHub Pages bajo /<repo>/, se pasa BASE_PATH desde el workflow.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'icon.svg'],
      workbox: {
        // El diccionario pesa ~1 MB; se cachea en runtime, no en precache.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.(aff|dic)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'folio-dictionaries', expiration: { maxEntries: 2 } },
          },
        ],
      },
      manifest: {
        name: 'Folio',
        short_name: 'Folio',
        description: 'Un lugar para escribir.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#F5F4F0',
        theme_color: '#F5F4F0',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        file_handlers: [
          {
            action: base,
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
      } as never,
    }),
  ],
});
