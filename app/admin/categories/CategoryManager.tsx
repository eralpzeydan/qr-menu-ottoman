'use client';

import { useMemo, useState } from 'react';
import { ensureCsrf, getCsrf } from '../_components/csrfClient';

type Venue = { id: string; name: string; slug: string };
type Category = {
  id: string;
  venueId: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  displayOrder: number;
  isVisible: boolean;
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const sortCategories = (items: Category[]) =>
  [...items].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.name.localeCompare(b.name);
  });

export default function CategoryManager({
  venues,
  initialCategories,
}: {
  venues: Venue[];
  initialCategories: Category[];
}) {
  const [categories, setCategories] = useState(() => sortCategories(initialCategories));
  const initialVenueId = venues[0]?.id ?? '';
  const [form, setForm] = useState({
    venueId: initialVenueId,
    name: '',
    displayOrder: '',
    isVisible: true,
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const selectedCategories = useMemo(
    () => sortCategories(categories.filter((c) => c.venueId === form.venueId)),
    [categories, form.venueId]
  );

  const suggestedOrder = useMemo(() => {
    if (!selectedCategories.length) return 0;
    return Math.max(...selectedCategories.map((c) => c.displayOrder ?? 0)) + 1;
  }, [selectedCategories]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setSuccess(null);

    if (!form.venueId) {
      setErr('Lütfen bir mekan seçin');
      setSaving(false);
      return;
    }

    const nameValue = form.name.trim();
    const orderInput = form.displayOrder.trim();
    let parsedOrder: number | undefined;
    if (!nameValue) {
      setErr('Kategori adı boş bırakılamaz');
      setSaving(false);
      return;
    }
    if (orderInput) {
      const n = Number(orderInput);
      if (!Number.isInteger(n) || n < 0) {
        setErr('Sıralama için 0 veya pozitif tam sayı girin');
        setSaving(false);
        return;
      }
      parsedOrder = n;
    }

    try {
      await ensureCsrf();
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
        credentials: 'include',
        body: JSON.stringify({
          venueId: form.venueId,
          name: nameValue,
          displayOrder: parsedOrder,
          isVisible: form.isVisible,
        }),
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof d.error === 'string' ? d.error : 'Kaydedilemedi';
        setErr(msg);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { category?: Category };
      const createdCategory = data.category;
      if (!createdCategory) {
        setErr('Kategori oluşturulamadı');
        return;
      }

      setCategories((prev) => sortCategories([...prev, createdCategory]));
      let updatedCategory = createdCategory;

      // Görsel varsa yükle
      if (file) {
        setUploadingId(updatedCategory.id);
        let prepared: File;
        try {
          prepared = await prepareImageForUpload(file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Görsel işlenemedi';
          setErr(msg);
          setUploadingId(null);
          return;
        }
        const formData = new FormData();
        formData.append('file', prepared);
        const uploadRes = await fetch(`/api/categories/${createdCategory.id}/image`, {
          method: 'POST',
          headers: { 'x-csrf-token': getCsrf() },
          credentials: 'include',
          body: formData,
        });
        if (!uploadRes.ok) {
          const d = (await uploadRes.json().catch(() => ({}))) as { error?: unknown };
          const msg = typeof d.error === 'string' ? d.error : 'Görsel yüklenemedi';
          setErr(msg);
        } else {
          const body = (await uploadRes.json().catch(() => ({}))) as { url?: string };
          if (body.url) {
            updatedCategory = { ...updatedCategory, imageUrl: body.url };
            setCategories((prev) =>
              sortCategories(
                prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c))
              )
            );
          }
        }
        setUploadingId(null);
      }

      setForm((prev) => ({
        ...prev,
        name: '',
        displayOrder: '',
        isVisible: true,
      }));
      setFile(null);
      setFileInputKey((k) => k + 1);
      setSuccess('Kategori eklendi');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Beklenmeyen hata';
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    const confirmed = window.confirm(`"${target.name}" kategorisini silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    setErr(null);
    setSuccess(null);
    setDeletingId(id);
    try {
      await ensureCsrf();
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': getCsrf() },
        credentials: 'include',
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof d.error === 'string' ? d.error : 'Silinemedi';
        setErr(msg);
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setSuccess('Kategori silindi');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Beklenmeyen hata';
      setErr(msg);
    } finally {
      setDeletingId(null);
    }
  }

  if (!venues.length) {
    return (
      <div className="border rounded-lg p-4 text-sm text-red-600">
        Kategori ekleyebilmek için önce bir mekan oluşturmalısınız.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="space-y-3 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Yeni Kategori</h2>
            {success && <span className="text-xs text-green-700">{success}</span>}
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <div>
            <label className="block text-sm" htmlFor="category-venue">
              Mekan
            </label>
            <select
              id="category-venue"
              className="w-full border rounded px-3 py-2"
              value={form.venueId}
              onChange={(e) => setForm((prev) => ({ ...prev, venueId: e.target.value }))}
              required
            >
              <option value="">Bir mekan seçin</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm" htmlFor="category-name">
              İsim
            </label>
            <input
              id="category-name"
              className="w-full border rounded px-3 py-2"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Slug isimden otomatik üretilecek.</p>
          </div>
          <div>
            <label className="block text-sm" htmlFor="category-order">
              Sıralama (küçük rakam üstte)
            </label>
            <input
              id="category-order"
              type="number"
              min={0}
              className="w-full border rounded px-3 py-2"
              placeholder={`Örn: ${suggestedOrder}`}
              value={form.displayOrder}
              onChange={(e) => setForm((prev) => ({ ...prev, displayOrder: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Boş bırakılırsa otomatik sona eklenir.</p>
          </div>
          <div>
            <label className="block text-sm" htmlFor="category-image">
              Görsel (opsiyonel)
            </label>
            <input
              id="category-image"
              key={fileInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-gray-500 mt-1">
              JPG/PNG/WebP, maksimum 2MB. Seçilirse otomatik yüklenir.
            </p>
            {file && (
              <div className="text-xs text-gray-400 mt-1">Seçili: {file.name}</div>
            )}
            {uploadingId && (
              <div className="text-xs text-emerald-400 mt-1">Görsel yükleniyor…</div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVisible}
              onChange={(e) => setForm((prev) => ({ ...prev, isVisible: e.target.checked }))}
            />
            Menüde göster
          </label>
          <button
            disabled={saving || !form.venueId}
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor…' : 'Kategori Ekle'}
          </button>
        </form>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Seçili mekandaki kategoriler</h2>
            <span className="text-xs text-gray-500">{selectedCategories.length} adet</span>
          </div>
          {selectedCategories.length ? (
            <ul className="divide-y">
              {selectedCategories.map((cat) => (
                <li key={cat.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{cat.name}</div>
                    <div className="text-xs text-gray-500 break-all">/{cat.slug}</div>
                    {cat.imageUrl ? (
                      <div className="text-xs text-gray-500 break-all">Görsel: {cat.imageUrl}</div>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-gray-600 flex flex-col items-end gap-1">
                    <span>Sıra: {cat.displayOrder}</span>
                    <span className={cat.isVisible ? 'text-green-700' : 'text-gray-500'}>
                      {cat.isVisible ? 'Görünür' : 'Gizli'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      className="mt-1 rounded border px-2 py-1 text-[11px] hover:bg-red-50 text-red-700 border-red-200 disabled:opacity-60"
                    >
                      {deletingId === cat.id ? 'Siliniyor…' : 'Sil'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500 border rounded p-3 bg-gray-50">
              Bu mekanda henüz kategori yok.
            </div>
          )}
          <p className="text-xs text-gray-500">
            Diğer mekanların kategorilerini görmek için üstten mekan seçimini değiştirin.
          </p>
        </div>
      </div>
    </div>
  );
}

async function prepareImageForUpload(file: File) {
  if (file.size <= MAX_FILE_BYTES) {
    return file;
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('2 MB üzerindeki dosyalar yalnızca JPG, PNG veya WebP olabilir.');
  }
  return compressImage(file);
}

async function compressImage(file: File) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tarayıcı canvas desteği olmadan sıkıştırma yapılamıyor.');

  const maxAttempts = 8;
  const minSide = 256;
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const scale = attempt === 0 ? 1 : 0.85 ** attempt;
    const targetWidth = Math.max(minSide, Math.round(originalWidth * scale));
    const targetHeight = Math.max(minSide, Math.round(originalHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const quality = file.type === 'image/png' ? undefined : Math.max(0.5, 0.92 - attempt * 0.08);
    const blob = await canvasToBlob(canvas, file.type, quality);
    if (!blob) throw new Error('Görsel sıkıştırılamadı.');

    if (blob.size <= MAX_FILE_BYTES) {
      return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
    }
  }
  throw new Error('Görsel 2 MB altına indirilemedi, lütfen daha küçük bir görsel seçin.');
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel yüklenemedi.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
