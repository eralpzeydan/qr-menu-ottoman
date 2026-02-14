'use client';
import { useEffect } from 'react';
export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In development, stale SW/cache can break hydration and HMR.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.warn('Service worker unregister failed', error);
        });

      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch((error) => {
            console.warn('Cache cleanup failed', error);
          });
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  }, []);
  return <>{children}</>;
}
