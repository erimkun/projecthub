import type { Metadata } from 'next';
import './globals.css';

import type { Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Project Hub — Ekip Üretkenlik Paneli',
  description: 'Kişisel odak ve ekip şeffaflığı arasında denge kuran proje yönetim aracı',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/logo.png',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/logo.png',
        type: 'image/png',
      },
    ],
    shortcut: '/logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0d11',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(reg => console.log('SW registered successfully:', reg.scope))
                    .catch(err => console.log('SW registration failed:', err));
                });
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
