# Product Requirements Document (PRD)
## QR Menu SaaS Platform

**Version:** 1.0
**Date:** January 6, 2026
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Problem Statement](#problem-statement)
4. [Goals & Objectives](#goals--objectives)
5. [Target Audience](#target-audience)
6. [Technical Architecture](#technical-architecture)
7. [Feature Roadmap](#feature-roadmap)
8. [Infrastructure Requirements](#infrastructure-requirements)
9. [Success Metrics](#success-metrics)
10. [Risks & Mitigations](#risks--mitigations)

---

## Executive Summary

QR Menu is a digital menu platform for restaurants and cafes that allows customers to scan a QR code and view the menu on their mobile devices. The platform provides an admin panel for venue owners to manage their menus including products, categories, images, and pricing.

**Current State:** Single-tenant MVP with basic admin functionality, hosted on Vercel (free tier) with Neon PostgreSQL and Supabase storage.

**Vision:** Transform into a multi-tenant SaaS platform serving multiple restaurants/cafes with reliable infrastructure, enabling venue owners to independently manage their digital menus.

---

## Current State Analysis

### Tech Stack

| Component | Current Technology | Status |
|-----------|-------------------|--------|
| **Framework** | Next.js 14.2.5 + React 18.2.0 | Stable |
| **Language** | TypeScript 5.4.5 | Stable |
| **Database** | Neon PostgreSQL (via Prisma) | Issues Reported |
| **Auth** | iron-session (encrypted HTTP-only cookies) | Working |
| **Image Storage** | Supabase Storage | Working |
| **Hosting** | Vercel (Free Tier) | Limited |
| **Rate Limiting** | Upstash Redis / LRU Cache | Working |

### Current Features

#### Admin Panel (Working)
- [x] Product CRUD (create, read, update, soft-delete)
- [x] Category CRUD with display ordering
- [x] Image upload with client-side compression
- [x] Inline price editing with audit trail
- [x] Stock status management
- [x] Diet tags support
- [x] Venue/announcement management

#### Public Menu (Working)
- [x] Responsive menu display
- [x] Category-based navigation with images
- [x] Product search and price sorting
- [x] QR code generation per table
- [x] Analytics (ViewLog per visit)

#### Security (Implemented)
- [x] CSRF protection
- [x] Session-based authentication
- [x] Rate limiting middleware
- [x] Bcrypt password hashing

### Multi-Tenancy Status

**Foundation Exists:**
- Venue model implemented as tenant entity
- Data scoped by `venueId` across all models
- Slug-based routing (`/{venue-slug}/{tableId}`)

**Missing for Full Multi-Tenancy:**
- [ ] Per-venue admin user accounts
- [ ] Venue-scoped authentication
- [ ] Self-service venue onboarding
- [ ] Subscription/billing system
- [ ] Venue-specific settings and branding

---

## Problem Statement

### Critical Issues

#### 1. Accessibility Problem (HIGH PRIORITY)
**Symptom:** ~50% of customers cannot access the QR menu on their devices.

**Potential Causes:**
- Vercel Edge Network cold starts causing timeouts
- Neon PostgreSQL connection pooling limits on free tier
- SSL/TLS compatibility issues with older devices
- DNS resolution problems
- Rate limiting being too aggressive

**Impact:** Direct revenue loss for venue owners, poor customer experience.

#### 2. Vercel Free Tier Limitations (HIGH PRIORITY)
**Symptoms:**
- Limited image optimization transformations (1000/month)
- Serverless function execution time limits (10s)
- No guaranteed uptime SLA
- Cold start latency issues

**Current Usage Pattern:**
- Each menu view may trigger image transformations
- High-traffic venues exhaust quotas quickly

#### 3. Infrastructure Scalability (MEDIUM PRIORITY)
**Current Constraints:**
- Neon free tier: Limited compute, connection pooling
- Supabase free tier: 1GB storage, 2GB bandwidth/month
- No CDN for static assets
- No monitoring/alerting

---

## Goals & Objectives

### Primary Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **G1** | Fix accessibility issues - 99%+ menu availability | P0 |
| **G2** | Reliable infrastructure for production workloads | P0 |
| **G3** | Full multi-tenant SaaS architecture | P1 |
| **G4** | Self-service venue onboarding | P1 |
| **G5** | Scalable image handling without quota limits | P1 |

### Success Criteria

- Menu loads in <2 seconds on 3G connections
- 99.5% uptime guarantee
- Support 100+ venues without performance degradation
- Zero image transformation quota issues
- <1% error rate on menu access

---

## Target Audience

### Primary Users

#### 1. Venue Owners (B2B Customers)
- Small to medium restaurants and cafes
- Need simple menu management
- Non-technical users
- Want quick updates (prices, availability)

#### 2. End Customers (B2C Users)
- Restaurant/cafe guests
- Scanning QR codes on tables
- Wide range of devices (iOS, Android, old/new)
- Various network conditions (WiFi, 4G, 3G)

### User Personas

**Ahmet - Cafe Owner (Primary)**
- Runs a small cafe with 15 tables
- Updates menu 2-3 times per week
- Wants to change prices quickly during promotions
- Needs Turkish language support

**Zeynep - Restaurant Guest (End User)**
- Scans QR code at table
- Expects instant menu load
- May have older Android device
- Limited patience for slow loading

---

## Technical Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CURRENT STATE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐     ┌─────────┐     ┌─────────────────────┐   │
│   │ Client  │────▶│ Vercel  │────▶│ Neon PostgreSQL     │   │
│   │ (Mobile)│     │ (Free)  │     │ (Free Tier)         │   │
│   └─────────┘     └────┬────┘     └─────────────────────┘   │
│                        │                                     │
│                        ▼                                     │
│                  ┌───────────┐                              │
│                  │ Supabase  │                              │
│                  │ Storage   │                              │
│                  └───────────┘                              │
│                                                             │
│   ISSUES:                                                   │
│   • Cold starts on Vercel                                   │
│   • Connection limits on Neon                               │
│   • Image transformation quota exceeded                     │
│   • 50% users cannot access                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Architecture (Multi-Tenant SaaS)

```
┌─────────────────────────────────────────────────────────────┐
│                      PROPOSED STATE                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐     ┌─────────────────────────────────────┐   │
│   │ Client  │────▶│ Cloudflare CDN / Edge Cache         │   │
│   │ (Mobile)│     └───────────────┬─────────────────────┘   │
│   └─────────┘                     │                         │
│                                   ▼                         │
│                         ┌─────────────────┐                 │
│                         │  Application    │                 │
│                         │  (Railway/Fly)  │                 │
│                         └────────┬────────┘                 │
│                                  │                          │
│              ┌───────────────────┼───────────────────┐      │
│              ▼                   ▼                   ▼      │
│   ┌──────────────────┐ ┌─────────────────┐ ┌────────────┐   │
│   │ PostgreSQL       │ │ Cloudflare R2   │ │ Redis      │   │
│   │ (Railway/Neon    │ │ (Image Storage) │ │ (Sessions) │   │
│   │  Paid Tier)      │ │ Free egress     │ │            │   │
│   └──────────────────┘ └─────────────────┘ └────────────┘   │
│                                                             │
│   BENEFITS:                                                 │
│   • No cold starts (always-on containers)                   │
│   • Connection pooling with Prisma Accelerate              │
│   • Free image egress via R2                               │
│   • CDN edge caching for menus                             │
│   • 99.9% uptime SLA                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Roadmap

### Phase 1: Infrastructure Stabilization (P0)
**Goal:** Fix accessibility issues and ensure reliable menu access.

| Feature | Description | Effort |
|---------|-------------|--------|
| **1.1** Migrate to paid hosting | Move from Vercel free to Railway/Fly.io | Medium |
| **1.2** Database upgrade | Upgrade Neon or migrate to Railway PostgreSQL | Medium |
| **1.3** Image CDN | Move images to Cloudflare R2 with CDN | Medium |
| **1.4** Add monitoring | Sentry/Logflare for error tracking | Low |
| **1.5** Health checks | Implement /api/health endpoint | Low |
| **1.6** Connection pooling | Prisma Accelerate or PgBouncer | Medium |

### Phase 2: Multi-Tenant Foundation (P1)
**Goal:** Enable multiple independent venues with their own admin accounts.

| Feature | Description | Effort |
|---------|-------------|--------|
| **2.1** Venue-admin relationship | Link users to specific venues | Medium |
| **2.2** Role-based access control | Admin, Manager, Viewer roles per venue | Medium |
| **2.3** Venue onboarding flow | Self-service signup for new venues | High |
| **2.4** Venue settings | Logo, colors, announcement, opening hours | Medium |
| **2.5** Custom domain support | venue.yourdomain.com or custom domains | High |

### Phase 3: Enhanced Features (P2)
**Goal:** Add features that differentiate from competitors.

| Feature | Description | Effort |
|---------|-------------|--------|
| **3.1** Multi-language menus | Support English, Turkish, etc. per item | Medium |
| **3.2** QR code table ordering | Customers can order directly | High |
| **3.3** Analytics dashboard | View counts, popular items, peak hours | Medium |
| **3.4** Menu scheduling | Auto-publish/unpublish by time | Low |
| **3.5** Allergen management | Standard allergen icons and filters | Low |

### Phase 4: Monetization (P3)
**Goal:** Establish sustainable business model.

| Feature | Description | Effort |
|---------|-------------|--------|
| **4.1** Subscription plans | Free/Pro/Enterprise tiers | High |
| **4.2** Payment integration | Stripe/iyzico for subscriptions | High |
| **4.3** Usage metering | Track menu views, storage usage | Medium |
| **4.4** Billing dashboard | Invoices, usage reports | Medium |

---

## Infrastructure Requirements

### Option A: Railway (Recommended)

| Component | Service | Monthly Cost (Est.) |
|-----------|---------|---------------------|
| Application | Railway (Docker) | $5-20 |
| Database | Railway PostgreSQL | $5-15 |
| Redis | Railway Redis | $5 |
| Images | Cloudflare R2 | Free (< 10GB) |
| CDN | Cloudflare | Free |
| **Total** | | **$15-40/month** |

**Pros:**
- No cold starts (always-on containers)
- Integrated PostgreSQL with auto-backups
- Simple deployment from GitHub
- Predictable pricing
- Connection pooling included

### Option B: Fly.io

| Component | Service | Monthly Cost (Est.) |
|-----------|---------|---------------------|
| Application | Fly.io (2 instances) | $5-15 |
| Database | Fly Postgres | $5-10 |
| Redis | Fly Redis (Upstash) | Free-$5 |
| Images | Cloudflare R2 | Free |
| **Total** | | **$10-30/month** |

**Pros:**
- Edge deployment (closest region)
- Free allowance generous
- Litefs for SQLite at edge (alternative)

### Option C: Keep Vercel (Upgraded)

| Component | Service | Monthly Cost (Est.) |
|-----------|---------|---------------------|
| Application | Vercel Pro | $20/month |
| Database | Neon Pro | $19/month |
| Images | Cloudflare R2 | Free |
| Redis | Upstash | Free-$10 |
| **Total** | | **$39-49/month** |

**Pros:**
- Minimal code changes
- Keep existing deployment flow
- Better image optimization quota

### Image Storage Comparison

| Provider | Free Tier | Egress Cost | Transformation |
|----------|-----------|-------------|----------------|
| Supabase | 1GB storage | 2GB free | None |
| Cloudflare R2 | 10GB storage | **FREE** | Via Workers |
| AWS S3 | Limited | $0.09/GB | CloudFront |
| Vercel Blob | 1GB | 10GB free | Via Image Opt |

**Recommendation:** Cloudflare R2 for zero egress costs at scale.

---

## Success Metrics

### Technical KPIs

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Menu Load Time (p95) | Unknown | <2s | Lighthouse/RUM |
| Error Rate | ~50% (reported) | <1% | Sentry |
| Uptime | No SLA | 99.5% | UptimeRobot |
| Image Load Time | Unknown | <1s | RUM |
| API Response Time (p95) | Unknown | <500ms | Application logs |

### Business KPIs

| Metric | Current | 3-Month Target | 6-Month Target |
|--------|---------|----------------|----------------|
| Active Venues | 1 | 10 | 50 |
| Daily Menu Views | Unknown | 1000 | 5000 |
| User Retention | N/A | 80% | 85% |
| Customer Complaints | High | <5/month | <2/month |

---

## Risks & Mitigations

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Migration downtime | High | Medium | Blue-green deployment, DNS TTL |
| Data loss during migration | Critical | Low | Full backup before migration |
| New infrastructure bugs | Medium | Medium | Staged rollout, feature flags |
| Cost overrun | Medium | Low | Usage alerts, budget caps |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Existing customers churn | High | Medium | Fix issues quickly, communicate |
| Competition | Medium | High | Unique features, better UX |
| Slow adoption | Medium | Medium | Marketing, referral program |

---

## Appendix

### A. Database Schema (Current)

```
User ─────────────────┐
                      │
Venue ───────────────┼───▶ Category
  │                  │        │
  │                  │        ▼
  └──────────────────┼───▶ Product ──▶ PriceHistory
                     │
  └──────────────────┼───▶ Table
                     │
  └──────────────────┴───▶ ViewLog
```

### B. API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | No | Admin login |
| `/api/auth/logout` | POST | Yes | Logout |
| `/api/products` | GET/POST | Yes | List/create products |
| `/api/products/[id]` | PATCH/DELETE | Yes | Update/delete product |
| `/api/products/[id]/image` | POST | Yes | Upload product image |
| `/api/categories` | POST | Yes | Create category |
| `/api/categories/[id]` | PATCH/DELETE | Yes | Update/delete category |
| `/api/venue/[slug]/menu` | GET | No | Public menu data |
| `/api/qr/[tableId]` | POST | Yes | Generate QR code |

### C. Environment Variables Required

```bash
# Required
DATABASE_URL="postgresql://..."
SESSION_SECRET="min-32-chars"
NEXT_PUBLIC_BASE_URL="https://..."

# Recommended
SENTRY_DSN="..."
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Storage (choose one)
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET="..."
CLOUDFLARE_R2_ENDPOINT="..."
# OR
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

---

## Next Steps

1. **Immediate (This Week):**
   - [ ] Add monitoring (Sentry) to diagnose accessibility issues
   - [ ] Implement `/api/health` endpoint
   - [ ] Review Neon connection limits and logs

2. **Short Term (2 Weeks):**
   - [ ] Decide on hosting provider (Railway vs Fly.io vs Vercel Pro)
   - [ ] Migrate images to Cloudflare R2
   - [ ] Upgrade database tier or migrate

3. **Medium Term (1 Month):**
   - [ ] Implement per-venue admin accounts
   - [ ] Build venue onboarding flow
   - [ ] Add basic analytics dashboard

---

*Document maintained by: Development Team*
*Last updated: January 6, 2026*
