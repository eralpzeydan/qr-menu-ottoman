'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureCsrf, getCsrf } from '../../_components/csrfClient';

interface Product {
  id: string;
  name: string;
  category: string | null;
  categoryId?: string | null;
  priceCents: number;
  description: string | null;
  isActive: boolean;
  isInStock: boolean;
}
interface CategoryOption { id: string; name: string; slug: string }

const inputIds = {
  name: 'edit-product-name',
  category: 'edit-product-category',
  price: 'edit-product-price',
  description: 'edit-product-description',
} as const;

export default function EditProductForm({ product, categories }: { product: Product; categories: CategoryOption[] }) {
  const router = useRouter();
  const [state, setState] = useState({
    name: product.name,
    categoryId: product.categoryId ?? '',
    categoryValue: product.category ?? '',
    priceInput: Math.round(product.priceCents / 100).toString(),
    description: product.description ?? '',
    isActive: product.isActive,
    isInStock: product.isInStock,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const priceValue = state.priceInput.trim();
    const parsedPrice = Number(priceValue);
    if (!priceValue || Number.isNaN(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedPrice)) {
      setErr('Kuruşsuz tam lira fiyatı girin');
      setSaving(false);
      return;
    }
    const priceCents = parsedPrice * 100;
    await ensureCsrf();
    const selectedCategory = categories.find((c) => c.id === state.categoryId) || null;
    const payloadCategory = state.categoryValue || selectedCategory?.slug || selectedCategory?.name || '';
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
      credentials: 'include',
      body: JSON.stringify({
        name: state.name,
        categoryId: selectedCategory?.id,
        category: payloadCategory || undefined,
        priceCents,
        description: state.description,
        isActive: state.isActive,
        isInStock: state.isInStock,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ? JSON.stringify(d.error) : 'Kaydedilemedi');
      setSaving(false);
      return;
    }
    router.replace('/admin/products');
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <div>
        <label className="block text-sm" htmlFor={inputIds.name}>İsim</label>
        <input
          id={inputIds.name}
          className="w-full border rounded px-3 py-2"
          required
          value={state.name}
          onChange={e => setState({ ...state, name: e.target.value })}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div>
            <label className="block text-sm" htmlFor={inputIds.category}>Kategori</label>
            {categories.length ? (
              <select
                id={inputIds.category}
                className="w-full border rounded px-3 py-2"
                value={state.categoryId}
                onChange={e => {
                  const nextId = e.target.value;
                  const next = categories.find((c) => c.id === nextId);
                  setState(prev => ({
                    ...prev,
                    categoryId: nextId,
                    categoryValue: next?.slug ?? next?.name ?? prev.categoryValue,
                  }));
                }}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 border rounded text-sm text-gray-500 bg-gray-50">
                Bu mekan için kategori yok.
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500" htmlFor="edit-category-value">Kategori etiketi (API değeri)</label>
            <input
              id="edit-category-value"
              className="w-full border rounded px-3 py-2"
              value={state.categoryValue}
              onChange={e => setState({ ...state, categoryValue: e.target.value })}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm" htmlFor={inputIds.price}>Fiyat (TL)</label>
          <input
            id={inputIds.price}
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            className="w-full border rounded px-3 py-2"
            required
            value={state.priceInput}
            onChange={e => setState({ ...state, priceInput: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm" htmlFor={inputIds.description}>Açıklama</label>
        <textarea
          id={inputIds.description}
          className="w-full border rounded px-3 py-2"
          rows={3}
          value={state.description}
          onChange={e => setState({ ...state, description: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.isActive}
            onChange={e => setState({ ...state, isActive: e.target.checked })}
          />
          Aktif
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.isInStock}
            onChange={e => setState({ ...state, isInStock: e.target.checked })}
          />
          Stokta
        </label>
      </div>
      <button disabled={saving} className="rounded bg-black text-white px-4 py-2">
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}
