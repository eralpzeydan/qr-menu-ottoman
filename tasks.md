# QR Menu - Infrastructure + SubCategory Tasks

**Project:** qr-menu-ottoman  
**Last Updated:** February 14, 2026  
**Owner:** Eralp + Codex

---

## 1) Scope (This document only)

Bu task listesi iki ana hedefe odaklanir:

1. Uygulamayi uzun sure free tier ile ayakta tutmak icin mimari karari vermek.
2. Kategori yapisini `Category -> SubCategory` seklinde genisletmek ve admin panelde SubCategory yonetimini eklemek.

Bu dokuman, adim adim birlikte karar verip ilerlemek icin "decision gates" icerir.

---

## 2) Current State Snapshot (repo bazli)

- Framework: Next.js 14 App Router
- DB: PostgreSQL + Prisma (`prisma/schema.prisma`)
- Storage adapter: Supabase + local fallback (`lib/storage/supabase.ts`, `lib/storage/local.ts`)
- Category model: tek seviye (`Category`), Product icinde `categoryId` + `category` text alanlari var
- Admin category UI: sadece category ekleme/silme (`app/admin/categories/CategoryManager.tsx`)
- Public menu API: category ve product ayrik query (`app/api/venue/[slug]/menu/route.ts`)

---

## 3) Architecture Decision Track (Free Tier Survival)

## A. Success Criteria (oncelikle karar verecegimiz metrikler)

- [ ] **INF-001** Aylik trafik hedefi netlestir
  - Girdiler: gunluk menu goruntuleme, admin panel kullanim sikligi, aylik image trafik tahmini
  - Cikti: `low / medium / high` trafik profili

- [ ] **INF-002** Uptime beklentisini netlestir
  - Hedef: "free tierde makul sureklilik" mi, yoksa "ticari SLA seviyesine yakin" mi?
  - Cikti: kabul edilebilir kesinti siniri (ornek: ayda toplam <2 saat)

- [ ] **INF-003** Maliyet siniri belirle
  - Cikti: `strict free only` veya `free + acil durumda 5-10 USD`

## B. Candidate Architectures

### Option A (Hybrid): Cloudflare Workers/Pages + Supabase Postgres + Cloudflare R2

- Arti:
  - Global edge dagitimi
  - R2 egress-free image serving
  - PostgreSQL + Prisma ile mevcut modele en az DB degisikligi
- Risk:
  - Supabase Free dusuk aktivitede pause olabilir
  - Workers free limits (request/cpu) dinamik Next route'larda dar bogaz olabilir
- Notes:
  - Full-stack Next icin Pages static tek basina yeterli degil; Workers deployment path gerekli

### Option B (Single Vendor): Cloudflare Workers + D1 + R2

- Arti:
  - Vendor sadeligi
  - Supabase pause riski ortadan kalkar
- Risk:
  - PostgreSQL -> D1 (SQLite) migration maliyeti yuksek
  - Prisma ve query davranisinda ek uyarlama gerektirir

### Option C (Min migration): Vercel (veya mevcut host) + Supabase Postgres + R2

- Arti:
  - En dusuk uygulama kodu migration maliyeti
- Risk:
  - Ilk problem statement'teki erisim/sureklilik sikayetlerini tam cozme riski

## C. Hard Constraints from Current Provider Docs (to verify in implementation)

- [ ] **INF-004** Cloudflare Pages/Workers limitlerini proje tahminiyle eslestir
  - Workers free request limiti
  - CPU limit ve Next SSR route etkisi
  - Pages build limits

- [ ] **INF-005** Supabase free quotas + pause davranisini karar matrisine isle
  - DB size
  - Egress kotasi
  - Dusuk aktivitede pause riski

- [ ] **INF-006** R2 quotas + operation maliyetini image trafigi ile modelle
  - A/B operation tahmini
  - bucket lifecycle/purge politikasi

## D. Decision Gate #1 (Mimari karari)

- [ ] **INF-007** 1 sayfalik karar ozetini hazirla
  - Kriter puanlari: guvenilirlik, migration maliyeti, free-tier dayanimi, operasyon karmasikligi
  - Secim: `A` / `B` / `C`
  - Cikti: secilen yol + neden

---

## 4) Infrastructure Execution Tasks (after Decision Gate #1)

## Phase I - Cloudflare deployment backbone

- [ ] **INF-101** Deploy target setup
  - Cloudflare account, project, environments (`preview`, `production`)
  - Branch-based deployment policy

- [ ] **INF-102** Next.js deployment adaptation
  - Full-stack Next icin Workers uyumlu adapter/config
  - Build/deploy scripts update
  - Preview runtime smoke test

- [ ] **INF-103** Runtime compatibility audit
  - Prisma runtime (edge/client engine, adapter, driver) kontrolu
  - Node-only package risk listesi
  - Gerekirse fallback plan: admin/public split deploy

## Phase II - Database path

- [ ] **INF-201** DB baglanti stratejisi
  - Supabase path secilirse: pooling/supavisor ayari + migration direct connection stratejisi
  - D1 path secilirse: prisma provider ve migration plani

- [ ] **INF-202** Secret/env policy
  - `.env.example` genisletme
  - Cloudflare secret binding map
  - local/dev/prod env parity checklist

- [ ] **INF-203** Health + reliability baseline
  - `/api/health` external uptime monitor
  - menu endpoint latency/error dashboard

## Phase III - Storage path (R2)

- [ ] **INF-301** R2 adapter implementation
  - Yeni adapter: `lib/storage/r2.ts`
  - Provider selection: `STORAGE_PROVIDER=r2|supabase|local`
  - Public URL strategy (custom domain or r2.dev)
  - Status: In progress (R2 adapter + provider selector kodlandi, env baglama bekliyor)

- [ ] **INF-302** Existing image migration script
  - Supabase/local -> R2 copy script
  - Product + Category image URL backfill
  - Retry + idempotency

- [ ] **INF-303** Cache strategy
  - Immutable asset naming
  - Cache-Control headers
  - CDN invalidation policy (gerektiginde)

## Phase IV - Go-live

- [ ] **INF-401** Staging cutover dry-run
- [ ] **INF-402** Production cutover (low traffic window)
- [ ] **INF-403** 7 gunluk gozlem ve rollback readiness

---

## 5) Data Model Refactor - Category -> SubCategory

## A. Data modeling decision

- [ ] **CAT-001** Model secimi (Decision Gate #2)
  - **Model-1 (onerilen):** ayri `SubCategory` tablosu
  - Model-2: `Category` self-reference (`parentId`)
  - Kriter: sorgu sadeligi, admin UX, migration riski

## B. Prisma schema changes (Model-1 baz alinir)

- [ ] **CAT-101** `SubCategory` modeli ekle
  - Fields (onerilen):
    - `id`, `venueId`, `categoryId`, `name`, `slug`
    - `displayOrder`, `isVisible`, `createdAt`, `updatedAt`
  - Index/constraints:
    - `@@unique([venueId, categoryId, slug])`
    - `@@index([venueId, categoryId, isVisible, displayOrder])`
  - Status: In progress (Prisma schema + SQL migration eklendi)

- [ ] **CAT-102** `Product` modeline `subCategoryId` ekle
  - Relation: `Product.subCategoryRel -> SubCategory`
  - Gecis asamasi icin `categoryId` bir sure korunur
  - Status: In progress (nullable `subCategoryId` + index eklendi)

- [ ] **CAT-103** Migration script + backfill
  - Her mevcut `Category` icin varsayilan subcategory olustur (`Genel` gibi)
  - Mevcut product'lari uygun subcategory'e bagla
  - Veri dogrulama query'leri

- [ ] **CAT-104** Seed update
  - `prisma/seed.ts` category + subcategory kurgusuna guncellenir

## C. API changes

- [ ] **CAT-201** Category API genisletme
  - Category create/list/delete davranisi subcategory bagimliligini dikkate alacak

- [ ] **CAT-202** SubCategory API ekleme
  - `POST /api/subcategories`
  - `DELETE /api/subcategories/[id]`
  - (opsiyonel) `PATCH /api/subcategories/[id]`
  - Status: In progress (`POST` + `DELETE` endpointleri eklendi)

- [ ] **CAT-203** Product API update
  - Create/Patch payload: `subCategoryId` desteklenecek
  - Validation: category-subcategory venue tutarliligi
  - `category` string alaninin rolu netlestirilecek (gecis/final)
  - Status: In progress (Create/Patch route'lara `subCategoryId` validation eklendi)

- [ ] **CAT-204** Public menu API update
  - Response yapisi nested olacak:
    - categories[]
    - each category has subCategories[]
    - products grouped or linked by subCategoryId

## D. Admin panel changes

- [ ] **CAT-301** CategoryManager UI split
  - Category formu korunur
  - Yeni SubCategory formu eklenir (parent category secimi ile)
  - Status: In progress (alt kategori ekleme/silme UI eklendi)

- [ ] **CAT-302** Category list UI
  - Category altinda subcategory listesi
  - Delete guard:
    - category silmeden once subcategory+product baglari kontrol edilir
    - subcategory silmeden once product bagi kontrol edilir

- [ ] **CAT-303** Product create/edit formlari
  - Once category secimi, sonra subcategory dropdown
  - Venue/category baglami degisince subcategory reset davranisi
  - Status: In progress (create/edit formlarina subcategory secimi eklendi)

## E. Public menu UI changes

- [ ] **CAT-401** MenuClient category filtering update
  - Secim modeli: `ALL -> Category -> SubCategory`
  - Geri uyumluluk: eski data varsa graceful fallback
  - Status: In progress (category altinda `Tümü + subcategory` filtre/grup render eklendi)

- [ ] **CAT-402** Category image davranisi
  - Category image + (opsiyonel) subcategory image stratejisi

---

## 6) Validation, Tests, and Safety Nets

- [ ] **TST-001** Unit tests
  - schema validators
  - category/subcategory resolver logic

- [ ] **TST-002** Integration API tests
  - subcategory CRUD
  - product create/update with subcategory
  - menu endpoint nested response

- [ ] **TST-003** Regression tests
  - existing category/product flows bozulmama kontrolu

- [ ] **TST-004** Data migration verification
  - pre/post migration counts
  - orphan product check

- [ ] **TST-005** Performance smoke
  - menu endpoint p95
  - admin create/update latency

---

## 7) Collaboration Workflow (how we proceed together)

Her buyuk adimdan once karar alacagiz:

1. **Decision Gate #1:** Mimari secimi (A/B/C)
2. **Decision Gate #2:** SubCategory model secimi (Model-1/Model-2)
3. **Decision Gate #3:** Gecis stratejisi
   - Soft migration (gecis sureci, legacy alanlar bir sure kalir)
   - Hard migration (tek seferde yeni modele gecis)

Karar sonrasi adimlar:

- [ ] Scope lock
- [ ] Kod degisiklikleri
- [ ] Test + migration dry run
- [ ] Onay
- [ ] Production adimi

---

## 8) Suggested First 3 Actions (Start Now)

- [ ] **NOW-1** Decision Gate #1 icin trafik ve maliyet varsayimlarini netlestirelim
- [ ] **NOW-2** Option A vs B icin kisa teknik risk karsilastirmasi yapalim (bu repo ozelinde)
- [ ] **NOW-3** Karar ciktiktan sonra direkt INF-101 ile uygulamaya gecelim
