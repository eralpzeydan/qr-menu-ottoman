import './globals.css';
import Providers from './providers';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata = {
  title: 'Cleopatra Coffee',
  description: 'Cleopatra Coffee için hızlı, çevrimdışı okunabilir QR menü deneyimi',
  openGraph: { title: 'Cleopatra Coffee', description: 'Cleopatra Coffee menüsü', type: 'website' },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <meta name="theme-color" content="#000000"/>
        <link rel="manifest" href="/manifest.json"/>
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
