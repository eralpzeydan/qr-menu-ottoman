'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureCsrf, getCsrf } from '../_components/csrfClient';

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function del() {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    setLoading(true);
    await ensureCsrf();
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': getCsrf() },
      credentials: 'include',
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert('Silinemedi');
    }
  }

  return (
    <button onClick={del} disabled={loading} className="underline text-red-600">
      {loading ? 'Siliniyor…' : 'Sil'}
    </button>
  );
}
