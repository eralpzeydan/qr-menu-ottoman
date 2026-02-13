import { headers } from 'next/headers';
import MenuClient from './MenuClient';

// Force dynamic rendering and disable caching for real-time menu updates
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { venue: string; tableId?: string[] };

async function fetchMenu(venue: string, tableId?: string) {
  const hdrs = headers();
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '';
  const base = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;

  const url = `${base}/api/venue/${venue}/menu${tableId ? `?tableId=${tableId}` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
      throw new Error(errorData.error || `Menü alınamadı (${res.status})`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Menü yükleme zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.');
      }
      throw error;
    }
    throw new Error('Menü yüklenirken beklenmeyen bir hata oluştu.');
  }
}

export default async function Page({ params }: { params: Params }) {
  const { venue } = params;
  const tableId = params.tableId?.[0];
  const { venue: venueData, products, categories } = await fetchMenu(venue, tableId);

  return <MenuClient venue={venueData} products={products} categories={categories} />;
}
