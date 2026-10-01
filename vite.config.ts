import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Cuando se despliega en GitHub Pages bajo /<repo>/, se pasa BASE_PATH desde el workflow.
const base = process.env.BASE_PATH ?? '/';

// Versión de los assets del diccionario: cambia en cada build, así el runtime cache nunca sirve
// un diccionario antiguo tras actualizar el paquete.
const dictVersion = Date.now().toString(36);

export default defineConfig({
  base,
  define: { __DICT_VERSION__: JSON.stringify(dictVersion) },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
  plugins: [
    VitePWA({
      // En 'prompt' el SW nuevo espera: no limpia el precache antiguo mientras la app sigue
      // abierta (si lo hiciera, un worker lazy con hash antiguo daría 404). La recarga la decide
      // `main.ts` cuando no hay nada sin guardar ni paneles abiertos.
      registerType: 'prompt',
      // Sin `includeAssets`: los iconos y las fuentes ya entran por `globPatterns` (no se precachean dos veces).
      workbox: {
        // El diccionario pesa ~1 MB; se cachea en runtime, no en precache. La URL lleva `?v=`
        // (ver `dictionaries.ts`): al cambiar sirve uno nuevo en vez de quedarse con el antiguo.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.(aff|dic)(\?.*)?$/,
            handler: 'CacheFirst',
            options: { cacheName: 'todo-dictionaries', expiration: { maxEntries: 2 } },
          },
        ],
      },
      manifest: {
        name: 'FOLIO',
        short_name: 'FOLIO',
        description: 'Un bloc de notas persistente y silencioso.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#F5F4F0',
        theme_color: '#F5F4F0',
        // PNG generados con `npm run icons` a partir de icon.svg: iOS no acepta SVG y Android
        // necesita la variante enmascarable para recortar su forma.
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Archivos que la app instalada se ofrece a abrir desde el sistema: los `.txt` propios y
        // los `.md` de versiones anteriores. Registrar `.txt` hace que el sistema ofrezca folio para
        // cualquier `.txt`; un texto plano ajeno se carga en la tab 1 sin romper nada.
        file_handlers: [
          {
            action: base,
            accept: { 'text/plain': ['.txt'], 'text/markdown': ['.md', '.markdown'] },
          },
        ],
      } as never,
    }),
  ],
});
