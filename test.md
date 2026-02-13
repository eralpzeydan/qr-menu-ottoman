# Test Suites Overview

Bu dosya projedeki tüm test tabanının nasıl organize edildiğini, hangi senaryoları kapsadığını ve nasıl çalıştırılacağını özetler. Üç ana katmanımız var: **unit**, **integration** ve **e2e**. Toplamda 73 test vakası bulunuyor ve her biri mevcut davranışı korumayı hedefliyor.

---

## 1. Unit Tests (`tests/unit`)

| Dosya | Açıklama | Kapsam |
| --- | --- | --- |
| `lib/general.test.ts` | Yardımcı fonksiyonlar | `fmtTRY`, `toError`, rate limiter ve i18n JSON anahtar eşleşmeleri |
| `lib/schemas.test.ts` | Zod şemaları | `loginSchema`, `productCreateSchema`, `productPatchSchema` senaryoları |
| `lib/storage.test.ts` | Dosya/Upload altyapısı | `sanitizeFilename`, MIME tespiti, `localAdapter`, `supabaseAdapter` davranışları |
| `lib/auth.test.ts` | Auth yardımcıları | CSRF doğrulama fonksiyonları, `requireAdmin`, `readSession/getSession`, client-side `ensureCsrf/getCsrf` |

> Not: Unit testleri gerçek IO yerine mock'lar kullanır; Supabase, filesystem ve fetch çağrıları tamamen izole edilmiştir.

Çalıştırmak için:
```bash
pnpm test          # Vitest tüm unit + integration dosyalarını çalıştırır
pnpm vitest run tests/unit/lib/storage.test.ts
```

---

## 2. Integration Tests (`tests/integration/api`)

| Dosya | Açıklama | Kapsam |
| --- | --- | --- |
| `auth.test.ts` | Auth/Cookie akışları | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/csrf` |
| `products.test.ts` | Admin ürün API'leri | `/api/products`, `/api/products/[id]`, `/api/products/[id]/image`, `/api/products/[id]/change` |
| `menu.test.ts` | Public menü & QR servisleri | `/api/venue/[slug]/menu`, `/api/qr/[tableId]` |

Öne çıkanlar:
- Tüm Prisma çağrıları mock'lanır ve hata durumları (401, 403, 404, 429, slug çakışmaları vb.) doğrulanır.
- CSRF, rate limit ve session guard davranışları gerçek fonksiyonlara çarpan mock'larla test edilir.

Çalıştırmak için (örnek):
```bash
pnpm vitest run tests/integration/api/products.test.ts
```

---

## 3. E2E Tests (`tests/e2e/app.spec.ts`)

Playwright ile tek dosyada üç ana senaryo:

1. **Admin Authentication Flow** – `/admin/login`, `/api/auth/me`, `/api/auth/logout`
2. **Admin Product Management** – Yeni ürün oluşturma, düzenleme, silme, görsel yükleme
3. **Public Menu Experience** – QR menü görüntüleme, arama/filtreleme, cart etkileşimleri, `/api/qr` doğrulaması

Çalıştırmak için:
```bash
# Uygulama ayağa kalkmış olmalı (örn. pnpm dev)
npx playwright test
npx playwright test --headed --debug       # Adımları canlı izlemek için
```

Playwright raporlayıcısı otomatik çalışır; detayları görmek için `npx playwright show-report` veya ilgili trace.zip dosyalarını açabilirsiniz.

---

## Ortak Notlar

- **Env**: Unit/integration testleri `tests/utils/vitest.setup.ts` üzerinden `.env`'den (`dotenv`) gerekli değişkenleri okur. `SESSION_SECRET` boşsa testler hata verir.
- **Komutlar**: `pnpm test` → tüm Vitest dosyaları. E2E için ayrı `npx playwright test`.
- **Mock Stratejisi**: Supabase, iron-session, Prisma, storage adapter’ları, Next `headers/cookies` gibi dış bağımlılıklar `vi.mock` ile izole edilmiştir.
- **Kapsam**: 73 test, Next.js API katmanının büyük kısmını ve tüm kritik UI akışlarını kapsar. Yeni özellikler eklendiğinde ilgili dosyada yeni describe blokları açmak yeterlidir; ek dosyaya gerek yoktur.

Bu yapıyla test base daha derli toplu (8 Vitest dosyası + 1 Playwright dosyası) ve kolay yönetilebilir halde tutulur. Herhangi bir değişiklikte mevcut dosyalardaki blokları genişletmeniz yeterli olacak.
