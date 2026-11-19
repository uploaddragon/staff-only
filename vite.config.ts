import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/logo.svg', 'brand/logo-inverse.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '스태프온리',
        short_name: '스태프온리',
        description: '매장 직원 전용 유통기한·공지 앱',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        // 브랜드: 검정 + 라임 (앱을 켤 때 검정 바탕에 로고가 떠요)
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 글꼴 조각(92개)은 미리 받지 않고, 쓰일 때 받아서 저장해 둬요
        globIgnores: ['**/*.woff2'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
