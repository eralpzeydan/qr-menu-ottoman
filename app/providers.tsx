'use client';
import { useEffect } from 'react';
export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(()=>{
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Service worker registration failed', error);
      });
    }
  },[]);
  return <>{children}</>;
}
