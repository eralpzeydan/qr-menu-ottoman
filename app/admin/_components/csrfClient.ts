'use client';

export async function ensureCsrf() {
  if (!document.cookie.includes('XSRF-TOKEN=')) {
    await fetch('/api/csrf', { credentials: 'include', cache: 'no-store' });
  }
}

export function getCsrf() {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}