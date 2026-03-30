import type { Metadata } from 'next';
import './globals.css';
import { PWARegister } from '@/components/PWARegister';

import type { Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Project Hub — Ekip Üretkenlik Paneli',
  description: 'Kişisel odak ve ekip şeffaflığı arasında denge kuran proje yönetim aracı',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/logo.jpeg',
        type: 'image/jpeg',
      },
    ],
    apple: [
      {
        url: '/logo.jpeg',
        type: 'image/jpeg',
      },
    ],
    shortcut: '/logo.jpeg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0d11',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
