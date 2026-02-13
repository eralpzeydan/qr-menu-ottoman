'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureCsrf, getCsrf } from '../_components/csrfClient';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await ensureCsrf();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrf(),
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Giriş başarısız');
      }
      router.push('/admin'); // başarıda dashboard’a
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Giriş başarısız';
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm border rounded-xl p-5 space-y-4">
        <h1 className="text-xl font-semibold">Admin Giriş</h1>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <label className="block">
          <span className="text-sm">E-posta</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">Şifre</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
          />
        </label>
        <button
          disabled={loading}
          className="w-full rounded bg-black text-white py-2"
        >
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </form>
    </main>
  );
}
