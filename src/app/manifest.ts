// Web app manifest. Owner: P5. Icons from F3 (public/brand).
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Escape Door — Anime Merch',
    short_name: 'Escape Door',
    description: 'Original fan-inspired anime merch: oversized tees, hoodies, polaroids, posters, badges and cosplay props.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0b0f',
    theme_color: '#0b0b0f',
    lang: 'en-IN',
    categories: ['shopping', 'lifestyle'],
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
