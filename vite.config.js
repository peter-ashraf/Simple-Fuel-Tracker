import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const base = isProd ? '/Simple-Fuel-Tracker/' : '/';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.png', 'favicon.svg'],
        manifest: {
          name: 'Fuel Tracker',
          short_name: 'FuelTrack',
          description: 'Track your vehicle fuel consumption and costs',
          theme_color: '#10b981',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: base,
          scope: base,
          orientation: 'portrait',
          categories: ['utilities', 'productivity'],
          icons: [
            {
              src: 'icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        }
      })
    ]
  };
});
