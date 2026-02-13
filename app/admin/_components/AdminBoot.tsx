'use client';
import { useEffect } from 'react';

export default function AdminBoot() {
  useEffect(() => {
    const hasToken = typeof document !== 'undefined'
      && document.cookie
        .split(';')
        .map((c) => c.trim())
        .some((c) => c.startsWith('XSRF-TOKEN='));
    if (hasToken) return;
    // CSRF token cookie'sini server route set eder
    fetch('/api/csrf', { credentials: 'include', cache: 'no-store' }).catch((error) => {
      console.warn('CSRF token fetch failed', error);
    });
  }, []);
  return null;
}
