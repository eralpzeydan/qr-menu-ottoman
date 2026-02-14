# QR Menü Starter

Next.js 14 + Prisma + Tailwind + iron-session tabanlı QR menü uygulaması başlangıç projesi.

## Kurulum
```bash
pnpm install
cp .env.example .env
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm seed
pnpm dev
```
- Public menü: `http://localhost:3000/ornek-kafe/T1`
- Varsayılan admin: `owner@example.com / Admin123!`

## Notlar
- Upload klasörü: `public/uploads/`
- Service Worker `public/sw.js` ile temel offline cache (read-only)
- Prisma provider: `.env` ile `sqlite` (dev) veya `postgresql` (prod)
- `SESSION_SECRET` en az 32 karakter olmalı; üretmek için `openssl rand -hex 32` kullanabilirsiniz.
- Storage provider secimi: `STORAGE_PROVIDER=auto|r2|supabase|local`
  - `auto`: once R2, sonra Supabase, yoksa local fallback
