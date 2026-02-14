'use client';

import NextImage from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureCsrf, getCsrf } from '../../_components/csrfClient';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
type UploadStage = 'idle' | 'compressing' | 'uploading' | 'done';
const inputIds = {
  name: 'new-product-name',
  category: 'new-product-category',
  price: 'new-product-price',
  description: 'new-product-description',
} as const;

type VenueOption = { id: string; name: string; slug: string };
type CategoryOption = { id: string; name: string; slug: string; venueId: string };
type SubCategoryOption = { id: string; name: string; slug: string; venueId: string; categoryId: string };
type FormState = {
  venueId: string;
  categoryId: string;
  subCategoryId: string;
  name: string;
  priceInput: string;
  description: string;
  isActive: boolean;
  isInStock: boolean;
};

export default function NewProductForm({
  venues,
  categories,
  subCategories,
}: {
  venues: VenueOption[];
  categories: CategoryOption[];
  subCategories: SubCategoryOption[];
}) {
  const router = useRouter();
  const initialVenueId = venues[0]?.id ?? '';
  const initialCategory = categories.find((c) => c.venueId === initialVenueId);
  const [state, setState] = useState<FormState>({
    venueId: initialVenueId,
    categoryId: initialCategory?.id ?? '',
    subCategoryId: '',
    name: '',
    priceInput: '',
    description: '',
    isActive: true,
    isInStock: true,
  });
  const [img, setImg] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const categoriesForVenue = useMemo(
    () => categories.filter((c) => c.venueId === state.venueId),
    [categories, state.venueId]
  );
  const subCategoriesForSelection = useMemo(
    () =>
      subCategories.filter(
        (s) => s.venueId === state.venueId && s.categoryId === state.categoryId
      ),
    [state.categoryId, state.venueId, subCategories]
  );

  useEffect(() => {
    if (!categoriesForVenue.length) {
      setState((prev) => ({ ...prev, categoryId: '', subCategoryId: '' }));
      return;
    }
    const exists = categoriesForVenue.some((c) => c.id === state.categoryId);
    if (!exists) {
      const fallback = categoriesForVenue[0];
      setState((prev) => ({ ...prev, categoryId: fallback.id, subCategoryId: '' }));
    }
  }, [categoriesForVenue, state.categoryId]);

  useEffect(() => {
    if (!subCategoriesForSelection.length) {
      if (state.subCategoryId) setState((prev) => ({ ...prev, subCategoryId: '' }));
      return;
    }
    const exists = subCategoriesForSelection.some((s) => s.id === state.subCategoryId);
    if (!exists) {
      setState((prev) => ({ ...prev, subCategoryId: subCategoriesForSelection[0].id }));
    }
  }, [state.subCategoryId, subCategoriesForSelection]);

  useEffect(() => {
    if (!img) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(img);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [img]);

async function submit(e: React.FormEvent) {
  e.preventDefault();
  setSaving(true);
  setErr(null);
  if (!state.venueId) {
    setErr('Lütfen bir mekan seçin');
    setSaving(false);
    return;
  }
  const priceValue = state.priceInput.trim();
  const parsedPrice = Number(priceValue);
  if (!priceValue || Number.isNaN(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedPrice)) {
    setErr('Kuruşsuz tam lira fiyatı girin');
    setSaving(false);
    return;
  }
  const priceCents = parsedPrice * 100;
  const selectedCategory = categories.find((c) => c.id === state.categoryId) || null;
  if (!selectedCategory) {
    setErr('Lütfen bir kategori seçin');
    setSaving(false);
    return;
  }
  await ensureCsrf();
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
    credentials: 'include',
    body: JSON.stringify({
      venueId: state.venueId,
      name: state.name,
      categoryId: selectedCategory.id,
      subCategoryId: state.subCategoryId || undefined,
      category: selectedCategory.slug || selectedCategory.name,
      priceCents,
      description: state.description,
      isActive: state.isActive,
      isInStock: state.isInStock
    })
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: unknown };
    const errorMessage =
      typeof d.error === 'string'
        ? d.error
        : d.error
        ? JSON.stringify(d.error)
        : 'Kaydedilemedi';
    setErr(errorMessage);
    setSaving(false);
    return;
  }
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  const id = data?.id;
  if (img && id) {
    try {
      setUploadStage('compressing');
      setUploadMessage(img.size > MAX_FILE_BYTES ? 'Görsel sıkıştırılıyor…' : 'Dosya doğrulanıyor…');
      setUploadProgress(5);
      const preparedFile = await prepareImageForUpload(img, percent => {
        setUploadProgress(Math.min(50, percent));
      });

      setUploadStage('uploading');
      setUploadMessage('Fotoğraf yükleniyor…');
      await uploadProductImage({
        file: preparedFile,
        productId: id,
        csrfToken: getCsrf(),
        onProgress: percent => {
          const normalized = Math.min(100, 50 + Math.round(percent * 0.5));
          setUploadProgress(normalized);
        }
      });
      setUploadStage('done');
      setUploadMessage('Fotoğraf başarıyla yüklendi.');
      setUploadProgress(100);
    } catch (error: unknown) {
      setUploadStage('idle');
      setUploadProgress(0);
      setUploadMessage(null);
      const message = error instanceof Error ? error.message : 'Foto yüklenemedi';
      setErr(message);
      setSaving(false);
      return;
    }
  }
  router.replace('/admin/products');
  router.refresh();
}



  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {!venues.length && (
        <div className="text-sm text-red-600">
          Ürün ekleyebilmek için önce bir mekan oluşturmalısınız.
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="relative w-28 h-20 bg-gray-100 rounded overflow-hidden">
          {previewUrl && (
            <NextImage
              src={previewUrl}
              alt="Ürün önizleme"
              fill
              className="object-cover"
              unoptimized
            />
          )}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp"
          onChange={e => {
            setImg(e.target.files?.[0] || null);
            setUploadStage('idle');
            setUploadProgress(0);
            setUploadMessage(null);
          }} />
      </div>
      {uploadStage !== 'idle' && (
        <div className="space-y-1">
          {uploadMessage && <div className="text-xs text-gray-600">{uploadMessage}</div>}
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className={`h-2 transition-all ${uploadStage === 'done' ? 'bg-green-600' : 'bg-black'}`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="text-[11px] text-gray-500">{uploadProgress}%</div>
        </div>
      )}
      <div>
        <label className="block text-sm" htmlFor={inputIds.name}>İsim</label>
        <input id={inputIds.name} className="w-full border rounded px-3 py-2" required
          value={state.name} onChange={e=>setState({...state, name: e.target.value})}/>
      </div>
      <div>
        <label className="block text-sm" htmlFor="venue-select">Mekan</label>
        <select
          id="venue-select"
          className="w-full border rounded px-3 py-2"
          value={state.venueId}
          onChange={(e) => setState({ ...state, venueId: e.target.value })}
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
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div>
            <label className="block text-sm" htmlFor={inputIds.category}>Kategori</label>
            {categoriesForVenue.length > 0 ? (
              <select
                id={inputIds.category}
                className="w-full border rounded px-3 py-2"
                value={state.categoryId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const next = categories.find((c) => c.id === nextId);
                  setState((prev) => ({
                    ...prev,
                    categoryId: next ? next.id : nextId,
                    subCategoryId: '',
                  }));
                }}
              >
                {categoriesForVenue.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 border rounded text-sm text-gray-500 bg-gray-50">
                Bu mekan için kategori tanımlı değil.{' '}
                <a className="underline" href="/admin/categories">Kategori ekleyin.</a>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm" htmlFor="new-product-subcategory">Alt Kategori</label>
            {subCategoriesForSelection.length > 0 ? (
              <select
                id="new-product-subcategory"
                className="w-full border rounded px-3 py-2"
                value={state.subCategoryId}
                onChange={(e) => setState((prev) => ({ ...prev, subCategoryId: e.target.value }))}
              >
                {subCategoriesForSelection.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 border rounded text-sm text-gray-500 bg-gray-50">
                Bu kategori için alt kategori tanımlı değil.
              </div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-sm" htmlFor={inputIds.price}>Fiyat (TL)</label>
          <input id={inputIds.price} type="number" inputMode="numeric" step={1} min={0} required className="w-full border rounded px-3 py-2"
            value={state.priceInput}
            onChange={e=>setState({...state, priceInput: e.target.value})}/>
        </div>
      </div>
      <div>
        <label className="block text-sm" htmlFor={inputIds.description}>Açıklama</label>
        <textarea id={inputIds.description} className="w-full border rounded px-3 py-2" rows={3}
          value={state.description} onChange={e=>setState({...state, description: e.target.value})}/>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.isActive}
            onChange={e=>setState({...state, isActive: e.target.checked})}/> Aktif
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.isInStock}
            onChange={e=>setState({...state, isInStock: e.target.checked})}/> Stokta
        </label>
      </div>
      <button disabled={saving || !state.venueId} className="rounded bg-black text-white px-4 py-2 disabled:opacity-60">
        {saving ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}

async function prepareImageForUpload(file: File, onProgress?: (percent: number) => void) {
  if (file.size <= MAX_FILE_BYTES) {
    onProgress?.(50);
    return file;
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('2 MB üzerindeki dosyalar yalnızca JPG, PNG veya WebP olabilir.');
  }
  return compressImage(file, onProgress);
}

async function compressImage(file: File, onProgress?: (percent: number) => void) {
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

    const percent = Math.round(((attempt + 1) / maxAttempts) * 50);
    onProgress?.(percent);

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

type UploadProductImageArgs = {
  file: File;
  productId: string;
  csrfToken: string;
  onProgress?: (percent: number) => void;
};

function uploadProductImage({ file, productId, csrfToken, onProgress }: UploadProductImageArgs) {
  return new Promise<{ url?: string }>((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/products/${productId}/image`);
    xhr.responseType = 'json';
    xhr.setRequestHeader('x-csrf-token', csrfToken);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress?.(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = (xhr.response ?? {}) as { url?: string; error?: string };
        resolve(data);
      } else {
        const errorResponse = xhr.response as { error?: string } | null;
        const message = errorResponse?.error || 'Foto yüklenemedi';
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Foto yükleme sırasında ağ hatası oluştu.'));
    xhr.send(formData);
  });
}
