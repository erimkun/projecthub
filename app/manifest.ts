import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Project Hub — Ekip Üretkenlik Paneli',
    short_name: 'Project Hub',
    description: 'Mobil ve masaüstünde kurulabilir ekip üretkenlik paneli',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0c0d11',
    theme_color: '#0c0d11',
    icons: [
      {
        src: '/logo.jpeg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/logo.jpeg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/logo.jpeg',
        sizes: 'any',
        type: 'image/jpeg',
      },
    ],
  };
}