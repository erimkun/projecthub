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
        src: '/haklıadam.jpeg',
        sizes: '1300x1300',
        type: 'image/jpeg',
      },
    ],
  };
}