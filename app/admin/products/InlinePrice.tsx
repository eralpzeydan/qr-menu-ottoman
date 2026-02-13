'use client';

import { useEffect, useState } from 'react';
import { ensureCsrf, getCsrf } from '../_components/csrfClient';

export default function InlinePrice({ id, price }: { id: string; price: number }) {
  const toLira = (cents: number) => Math.round(cents / 100).toString();

  const [currentPriceCents, setCurrentPriceCents] = useState(price);
  const [val, setVal] = useState(toLira(price));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPriceCents(price);
    setVal(toLira(price));
  }, [price]);

   async function save() {
    const priceValue = val.trim();
    const parsedPrice = Number(priceValue);
    if (!priceValue || Number.isNaN(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedPrice)) {
      setMsg('Tam lira değeri girin');
      return;
    }
    const nextPriceCents = parsedPrice * 100;
    if (nextPriceCents === currentPriceCents) { setMsg('Değişiklik yok'); return; }
    setSaving(true); setMsg(null);
    await ensureCsrf();
    const res = await fetch(`/api/products/${id}/change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
      credentials: 'include',
      body: JSON.stringify({ newPriceCents: nextPriceCents, reason: 'Admin paneli' })
    });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      setMsg(d.error || 'Hata');
    } else {
      const data = await res.json().catch(() => ({}));
      if (typeof data.newPriceCents === 'number') {
        setCurrentPriceCents(data.newPriceCents);
        setVal(toLira(data.newPriceCents));
      }
      setMsg('Kaydedildi');
    }
    setSaving(false);
  }


  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={0}
        className="w-28 border rounded px-2 py-1"
        value={val}
        onChange={e=>setVal(e.target.value)}
      />
      <button onClick={save} disabled={saving} className="px-2 py-1 rounded bg-black text-white">
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
