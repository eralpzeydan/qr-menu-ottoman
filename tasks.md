# QR Menu SaaS - Product Development Tasks

**Project:** QR Menu Platform - Single Tenant to Multi-Tenant SaaS Transformation
**Last Updated:** January 6, 2026
**PRD Version:** 1.0

---

## Executive Summary

This document breaks down the transformation roadmap from the current single-tenant MVP to a production-ready multi-tenant SaaS platform. Tasks are organized by phases with clear priorities, effort estimates, and dependencies.

**Current State:**
- Single-tenant MVP with admin panel (products, categories, images, pricing)
- Deployed on Vercel free tier with Neon PostgreSQL and Supabase storage
- 73 tests (unit, integration, E2E) providing solid coverage
- **CRITICAL ISSUE RESOLVED:** 50% accessibility failure fixed in commit 92bfaaa (Jan 6, 2026)

**Vision:**
- Multi-tenant SaaS serving 100+ venues
- Self-service onboarding with subscription billing
- 99.5% uptime with <2s menu load times
- Scalable infrastructure without quota limitations

---

## Current Status Overview

### What's Working ✓
- [x] Product CRUD with soft-delete
- [x] Category management with display ordering and images
- [x] Image upload with client-side compression
- [x] Inline price editing with audit trail (PriceHistory)
- [x] Stock status and diet tags
- [x] Venue/announcement management
- [x] QR code generation per table
- [x] Responsive public menu with search/sort
- [x] Session-based auth with CSRF protection
- [x] Rate limiting (Upstash Redis / LRU fallback)
- [x] Analytics (ViewLog per visit)
- [x] Multi-tenant data model (venueId scoping)
- [x] Slug-based routing (/{venue-slug}/{tableId})
- [x] Test coverage (73 tests: unit, integration, E2E)
- [x] Health check endpoint (/api/health)
- [x] Error boundaries and loading states
- [x] Prisma connection pooling fixes

### What's Missing ✗
- [ ] Per-venue admin user accounts (User-Venue relationship)
- [ ] Venue-scoped authentication (current auth is global)
- [ ] Self-service venue onboarding flow
- [ ] Subscription/billing system
- [ ] Production-grade infrastructure (paid hosting)
- [ ] CDN for images (Cloudflare R2)
- [ ] Monitoring and alerting (Sentry)
- [ ] Venue-specific branding/settings
- [ ] Multi-language support
- [ ] Table ordering functionality

---

## Phase 0: Immediate Post-Fix Validation

**Goal:** Validate the accessibility fixes deployed on Jan 6, 2026 and ensure stability.
**Duration:** 1 week
**Business Impact:** CRITICAL - Prevents revenue loss from inaccessible menus

### Monitoring & Validation

- [ ] **Deploy monitoring solution** - **P0** | **Medium**
  - Set up Sentry for error tracking and alerting
  - Configure source maps for better stack traces
  - Add custom error contexts (venueId, tableId, user agent)
  - Set up alerts for error rate >1%
  - **Dependencies:** None
  - **Outcome:** Real-time visibility into production errors

- [ ] **Create uptime monitoring** - **P0** | **Low**
  - Configure UptimeRobot or similar for /api/health endpoint
  - Monitor from multiple geographic locations
  - Set up SMS/email alerts for downtime
  - Track 99.5% uptime SLA
  - **Dependencies:** None
  - **Outcome:** Proactive downtime detection

- [ ] **Add performance monitoring** - **P1** | **Medium**
  - Implement Real User Monitoring (RUM) with Vercel Analytics or similar
  - Track Core Web Vitals (LCP, FID, CLS)
  - Monitor menu load time p95/p99
  - Track API response times per endpoint
  - **Dependencies:** None
  - **Outcome:** Data-driven performance optimization

- [ ] **Analyze accessibility fix impact** - **P0** | **Low**
  - Review Sentry logs for menu access errors (target: <1%)
  - Check ViewLog analytics for successful menu loads
  - Gather venue owner feedback on customer complaints
  - Document findings in PRD or separate report
  - **Dependencies:** Monitoring solution deployed
  - **Outcome:** Validation that 50% failure is resolved

### Quick Technical Debt

- [ ] **Add database query logging** - **P2** | **Low**
  - Enable Prisma query logging in production (with sampling)
  - Identify slow queries (>500ms)
  - Add indexes where needed (check @@index coverage)
  - **Dependencies:** None
  - **Outcome:** Database performance baseline

- [ ] **Review rate limiting effectiveness** - **P2** | **Low**
  - Analyze rate limit hits from middleware logs
  - Verify 300 requests/60s for menu endpoint is adequate
  - Consider per-IP vs per-venue rate limiting
  - **Dependencies:** Monitoring solution
  - **Outcome:** Optimized rate limits preventing abuse

---

## Phase 1: Infrastructure Stabilization

**Goal:** Migrate from free-tier services to production-grade infrastructure.
**Duration:** 2-3 weeks
**Business Impact:** HIGH - Enables scaling beyond 1 venue, ensures reliability

### Decision & Planning

- [ ] **Evaluate hosting options** - **P0** | **Medium**
  - Compare Railway, Fly.io, and Vercel Pro (see PRD cost analysis)
  - Consider cold start elimination (always-on containers)
  - Evaluate PostgreSQL options (Railway, Neon paid, Supabase)
  - Test deployment on candidate platform (staging environment)
  - Document decision with cost projections ($15-50/month)
  - **Dependencies:** None
  - **Outcome:** Selected hosting provider with justification
  - **RECOMMENDATION:** Railway for simplicity + integrated DB

- [ ] **Plan image storage migration** - **P0** | **Low**
  - Set up Cloudflare R2 bucket and API credentials
  - Plan migration strategy for existing Supabase images
  - Design URL structure (e.g., r2.domain.com/{venueId}/{productId}.webp)
  - **Dependencies:** None
  - **Outcome:** Migration plan for zero-egress image storage

- [ ] **Create infrastructure runbook** - **P1** | **Low**
  - Document deployment procedures
  - Create rollback plan (blue-green deployment strategy)
  - List all environment variables and secrets
  - Define backup and disaster recovery procedures
  - **Dependencies:** Hosting provider selected
  - **Outcome:** Operational playbook for infrastructure

### Migration Execution

- [ ] **Migrate to production hosting** - **P0** | **High**
  - Set up Railway/Fly.io account and project
  - Configure Docker deployment (if needed)
  - Set up environment variables and secrets
  - Deploy application to new infrastructure
  - Perform smoke tests (login, menu access, image upload)
  - **Dependencies:** Hosting provider selected, runbook created
  - **Outcome:** Application running on paid infrastructure

- [ ] **Upgrade or migrate database** - **P0** | **Medium**
  - Upgrade Neon to paid tier OR migrate to Railway PostgreSQL
  - Set up connection pooling (Prisma Accelerate or PgBouncer)
  - Configure automated daily backups
  - Test connection limits (simulate 100+ concurrent requests)
  - Migrate data from current database (full backup first!)
  - **Dependencies:** Hosting provider selected
  - **Outcome:** Production-grade database with backups

- [ ] **Migrate images to Cloudflare R2** - **P0** | **High**
  - Create storage adapter for R2 (extend lib/storage.ts)
  - Write migration script to copy Supabase → R2
  - Update image URLs in database (Product.imageUrl, Category.imageUrl)
  - Configure CDN/caching headers for optimal delivery
  - Verify all images load correctly
  - **Dependencies:** R2 setup complete, migration plan
  - **Outcome:** Zero-egress image storage with CDN

- [ ] **Set up Redis for sessions** - **P1** | **Medium**
  - Deploy Redis instance (Railway Redis or Upstash paid tier)
  - Update iron-session to use Redis for session storage (vs cookies)
  - Consider session TTL and cleanup strategy
  - Test session persistence across deployments
  - **Dependencies:** Hosting provider selected
  - **Outcome:** Scalable session management

### Cutover & Validation

- [ ] **Execute blue-green deployment** - **P0** | **Medium**
  - Update DNS to point to new infrastructure (low TTL first)
  - Monitor error rates and performance for 24 hours
  - Keep old infrastructure running for 48 hours as fallback
  - Document any issues and resolutions
  - **Dependencies:** All migrations complete, runbook ready
  - **Outcome:** Zero-downtime migration to new infrastructure

- [ ] **Post-migration validation** - **P0** | **Low**
  - Run full E2E test suite against production
  - Verify all 73 tests pass
  - Check Sentry for new errors
  - Test from multiple devices (iOS, Android, desktop)
  - Gather venue owner feedback
  - **Dependencies:** Blue-green deployment complete
  - **Outcome:** Confirmed production stability

- [ ] **Decommission old infrastructure** - **P1** | **Low**
  - Export final backups from Neon and Supabase
  - Cancel free-tier services (after 7 days of stable new infra)
  - Update documentation with new infrastructure details
  - **Dependencies:** 7 days of stable new infrastructure
  - **Outcome:** Clean cutover, cost optimization

---

## Phase 2: Multi-Tenant Foundation

**Goal:** Enable multiple venues with independent admin accounts and self-service onboarding.
**Duration:** 3-4 weeks
**Business Impact:** HIGH - Core SaaS functionality, enables growth

### Authentication & Authorization

- [ ] **Design User-Venue relationship** - **P0** | **Medium**
  - Add `VenueUser` junction table (userId, venueId, role)
  - Define roles: OWNER, MANAGER, VIEWER (start simple)
  - Update Prisma schema and create migration
  - Consider invitation flow (future: invite team members)
  - **Dependencies:** None
  - **Outcome:** Schema supporting multi-venue user access

- [ ] **Implement venue-scoped authentication** - **P0** | **High**
  - Update session to include `selectedVenueId`
  - Modify `requireAdmin` middleware to check VenueUser relationship
  - Add venue switcher UI for users with multiple venues
  - Update all API routes to enforce venue-scoped access
  - Test unauthorized access (user A cannot access venue B's data)
  - **Dependencies:** User-Venue relationship schema
  - **Outcome:** Secure multi-tenant authentication

- [ ] **Add role-based access control (RBAC)** - **P1** | **High**
  - Implement permission checks per role (OWNER can delete, VIEWER cannot)
  - Create `requireRole` middleware helper
  - Update admin UI to show/hide actions based on role
  - Add tests for RBAC enforcement
  - **Dependencies:** Venue-scoped auth implemented
  - **Outcome:** Fine-grained access control per venue

### Onboarding & Settings

- [ ] **Build venue onboarding flow** - **P0** | **High**
  - Create `/signup` page with venue registration form
  - Collect: venue name, slug (with availability check), owner email/password
  - Generate unique slug if requested slug is taken (e.g., "cafe-latte-2")
  - Send welcome email (optional: use nodemailer in package.json)
  - Auto-create first user as OWNER role
  - Create sample category/product to help new users get started
  - **Dependencies:** User-Venue relationship, venue-scoped auth
  - **Outcome:** Self-service venue creation

- [ ] **Create venue settings page** - **P1** | **Medium**
  - Build `/admin/settings` page for venue configuration
  - Allow editing: name, slug (with slug change validation), announcement, opening hours
  - Add venue logo upload (store in R2)
  - Add color customization (primary color for menu theme)
  - Update public menu to use venue logo and colors
  - **Dependencies:** Venue-scoped auth
  - **Outcome:** Venue-specific branding

- [ ] **Implement venue slug availability API** - **P1** | **Low**
  - Create `/api/venue/check-slug` endpoint
  - Real-time slug validation during signup
  - Return suggestions if slug is taken
  - **Dependencies:** None
  - **Outcome:** Better UX for slug selection

### Data Migration for Multi-Tenancy

- [ ] **Migrate existing single-tenant data** - **P0** | **Medium**
  - Create migration script to link existing User to existing Venue
  - Set existing user as OWNER of existing venue
  - Verify all existing products/categories still accessible
  - Test with production-like data volume
  - **Dependencies:** User-Venue schema, venue-scoped auth
  - **Outcome:** Existing data works in multi-tenant model

### Testing & Validation

- [ ] **Add multi-tenant test scenarios** - **P0** | **Medium**
  - Test user accessing multiple venues (venue switcher)
  - Test unauthorized access (user A tries to edit venue B)
  - Test signup flow with duplicate slugs
  - Test RBAC (VIEWER cannot delete products)
  - Add E2E tests for onboarding flow
  - **Dependencies:** All multi-tenant features implemented
  - **Outcome:** 95%+ coverage of multi-tenant scenarios

---

## Phase 3: Enhanced Features

**Goal:** Add differentiating features that improve user experience and analytics.
**Duration:** 4-6 weeks
**Business Impact:** MEDIUM - Competitive differentiation, user retention

### Analytics & Insights

- [ ] **Build analytics dashboard** - **P1** | **Medium**
  - Create `/admin/analytics` page
  - Display: total views (ViewLog count), views per day (chart)
  - Show popular items (most-viewed products)
  - Show peak hours (ViewLog grouped by hour)
  - Add date range picker (last 7/30/90 days)
  - **Dependencies:** None (uses existing ViewLog)
  - **Outcome:** Data-driven insights for venue owners

- [ ] **Enhance ViewLog tracking** - **P2** | **Low**
  - Add product-level view tracking (ProductViewLog)
  - Track search queries (SearchLog)
  - Track QR scan source (which table QR was scanned)
  - Consider privacy (anonymize or expire logs after 90 days)
  - **Dependencies:** None
  - **Outcome:** Richer analytics data

### Menu Features

- [ ] **Add multi-language menu support** - **P1** | **High**
  - Extend Product model: add `nameEn`, `descriptionEn` (optional fields)
  - Add language switcher to public menu (TR / EN)
  - Update admin UI to allow editing both languages
  - Consider using i18next more extensively (currently in package.json)
  - **Dependencies:** None
  - **Outcome:** Bilingual menus for international customers

- [ ] **Implement menu scheduling** - **P2** | **Low**
  - Add `publishAt` and `unpublishAt` to Product model
  - Create cron job or scheduled task to auto-publish/unpublish
  - Add scheduling UI in admin panel (date/time pickers)
  - Use for seasonal items, limited-time offers
  - **Dependencies:** None
  - **Outcome:** Time-based menu automation

- [ ] **Add allergen management** - **P2** | **Low**
  - Define standard allergen icons (gluten, dairy, nuts, etc.)
  - Add allergen field to Product model (JSON or separate table)
  - Display allergen icons on public menu
  - Add allergen filter in menu search
  - **Dependencies:** None
  - **Outcome:** Better accessibility for customers with dietary restrictions

### Table Ordering (High Value, High Effort)

- [ ] **Design table ordering architecture** - **P2** | **High**
  - Define Order model (orderId, tableId, items[], status, createdAt)
  - Plan real-time order updates (WebSocket or polling)
  - Design kitchen display system (separate admin view)
  - Consider payment integration (future: pay at table)
  - **Dependencies:** None
  - **Outcome:** Technical design for ordering feature

- [ ] **Implement customer ordering flow** - **P2** | **High**
  - Add "Add to Cart" button on public menu
  - Build cart UI with item count, total price
  - Create "Send Order" flow (POST to /api/orders)
  - Show order confirmation with estimated time
  - **Dependencies:** Order architecture designed
  - **Outcome:** Customers can place orders via QR menu

- [ ] **Build venue order management** - **P2** | **High**
  - Create `/admin/orders` page listing active orders
  - Add order status updates (pending → preparing → ready → completed)
  - Add real-time notifications (new order alert)
  - Consider printer integration (receipt printer API)
  - **Dependencies:** Customer ordering flow
  - **Outcome:** Venues can manage incoming orders

**BUILD/KILL DECISION:** Table ordering is HIGH effort. Consider killing this if:
- Venues express limited interest (survey needed)
- Existing POS systems handle ordering
- Effort could go toward monetization (subscriptions) instead
- **RECOMMENDATION:** Build only if 3+ venues request it as top feature

---

## Phase 4: Monetization & Business Model

**Goal:** Establish sustainable revenue with subscription plans and billing.
**Duration:** 3-4 weeks
**Business Impact:** CRITICAL - Business sustainability, revenue generation

### Subscription Strategy

- [ ] **Define pricing tiers** - **P0** | **Low**
  - **FREE:** 1 venue, 50 products, 500 views/month, community support
  - **PRO:** $29/month, unlimited products, 10K views/month, email support
  - **ENTERPRISE:** Custom pricing, white-label, API access, dedicated support
  - Document feature matrix and usage limits
  - **Dependencies:** None
  - **Outcome:** Clear pricing strategy

- [ ] **Add Subscription model** - **P0** | **Low**
  - Create Subscription table (venueId, plan, status, currentPeriodEnd)
  - Add subscription status to Venue (FREE, PRO, ENTERPRISE, TRIAL, CANCELED)
  - Define usage quotas (products count, views/month)
  - **Dependencies:** Pricing tiers defined
  - **Outcome:** Database schema for subscriptions

### Payment Integration

- [ ] **Integrate Stripe (or iyzico for Turkey)** - **P0** | **High**
  - Set up Stripe account and get API keys
  - Install Stripe SDK (@stripe/stripe-js)
  - Create `/api/subscriptions/create` endpoint (Stripe Checkout session)
  - Create `/api/webhooks/stripe` for subscription events
  - Handle subscription lifecycle (created, updated, canceled, payment_failed)
  - **Dependencies:** Subscription model created
  - **Outcome:** Functional payment processing

- [ ] **Build billing dashboard** - **P1** | **Medium**
  - Create `/admin/billing` page
  - Show current plan, usage stats, next billing date
  - Add "Upgrade Plan" button (Stripe Checkout link)
  - Show invoice history (Stripe invoices)
  - Add "Cancel Subscription" flow with confirmation
  - **Dependencies:** Stripe integration complete
  - **Outcome:** Self-service billing management

### Usage Metering & Limits

- [ ] **Implement usage tracking** - **P0** | **Medium**
  - Track product count per venue (check on create)
  - Track monthly views (ViewLog count by venueId, reset monthly)
  - Create `/api/admin/usage` endpoint for real-time usage
  - Add usage warnings when approaching limits (90% threshold)
  - **Dependencies:** Subscription model
  - **Outcome:** Automated usage enforcement

- [ ] **Add soft-limit enforcement** - **P1** | **Medium**
  - Block product creation if limit exceeded (FREE: 50 products)
  - Show upgrade prompt when limits hit
  - Allow grace period (e.g., 7 days over limit before blocking)
  - Consider hard limits vs soft limits (warn vs block)
  - **Dependencies:** Usage tracking implemented
  - **Outcome:** Enforced plan limits

### Trial & Conversion

- [ ] **Add 14-day free trial** - **P1** | **Low**
  - New venues start on TRIAL status (expires after 14 days)
  - Send email reminders (Day 7: "Trial halfway done", Day 13: "Last day!")
  - Auto-downgrade to FREE plan if no payment added
  - Track trial → paid conversion rate (target: 20%+)
  - **Dependencies:** Subscription model, email integration
  - **Outcome:** Conversion funnel for new users

### Monitoring & Optimization

- [ ] **Add business metrics dashboard** - **P2** | **Low**
  - Track MRR (Monthly Recurring Revenue)
  - Track churn rate (canceled subscriptions / active subscriptions)
  - Track CAC (Customer Acquisition Cost) if running ads
  - Track LTV (Lifetime Value) per customer
  - **Dependencies:** Subscriptions live in production
  - **Outcome:** Data-driven business decisions

---

## Technical Debt & Code Quality

**Goal:** Maintain code quality and reduce technical debt for long-term maintainability.
**Duration:** Ongoing

### High-Priority Debt

- [ ] **Remove deprecated `category` field from Product** - **P1** | **Low**
  - Product model has both `category` (string) and `categoryId` (relation)
  - Migrate any remaining `category` string data to `categoryId`
  - Remove `category` field from schema
  - Update any code still referencing old field
  - **Dependencies:** None
  - **Outcome:** Cleaner data model

- [ ] **Consolidate storage adapters** - **P2** | **Low**
  - Currently supporting both local and Supabase adapters
  - After R2 migration, remove Supabase adapter code
  - Keep local adapter for development only
  - **Dependencies:** R2 migration complete
  - **Outcome:** Simplified codebase

- [ ] **Add TypeScript strict mode** - **P2** | **Medium**
  - Enable `strict: true` in tsconfig.json
  - Fix all type errors (currently ~147 files)
  - Add return type annotations to functions
  - Remove `any` types where possible
  - **Dependencies:** None
  - **Outcome:** Better type safety, fewer runtime errors

### Testing Improvements

- [ ] **Improve test stability (E2E flakiness)** - **P2** | **Low**
  - Review Playwright tests for timing issues
  - Add explicit waits instead of hard-coded timeouts
  - Consider Cypress migration (evaluate pros/cons per task.md notes)
  - **Dependencies:** None
  - **Outcome:** 100% reliable E2E test runs

- [ ] **Add load testing** - **P2** | **Medium**
  - Use k6 or Artillery to simulate 100+ concurrent users
  - Test menu endpoint under load (target: <500ms p95)
  - Identify database query bottlenecks
  - Test connection pooling limits
  - **Dependencies:** Production infrastructure live
  - **Outcome:** Confidence in scalability

### Documentation

- [ ] **Create API documentation** - **P2** | **Low**
  - Document all public API endpoints (OpenAPI/Swagger)
  - Add request/response examples
  - Document authentication requirements
  - Include rate limits and error codes
  - **Dependencies:** None
  - **Outcome:** Easier integration for future API clients

- [ ] **Update README with multi-tenant setup** - **P1** | **Low**
  - Document new signup flow
  - Update environment variables for R2, Stripe
  - Add deployment instructions for Railway/Fly.io
  - Include troubleshooting guide
  - **Dependencies:** Multi-tenant features complete
  - **Outcome:** Faster onboarding for new developers

---

## Future Considerations (Post-Phase 4)

**Status:** Backlog - Not prioritized yet, evaluate based on customer feedback

### Advanced Features

- [ ] **Custom domain support** - **P3** | **High**
  - Allow venues to use custom domains (e.g., menu.cafe-latte.com)
  - Implement domain verification (DNS TXT record)
  - SSL certificate provisioning (Let's Encrypt or Cloudflare)
  - **Business Value:** Premium feature for ENTERPRISE plan
  - **Complexity:** High (DNS, SSL, routing)

- [ ] **White-label solution** - **P3** | **High**
  - Remove all QR Menu branding from public menu
  - Allow custom logos, colors, fonts per venue
  - Provide embeddable menu widget for venue websites
  - **Business Value:** ENTERPRISE differentiator
  - **Complexity:** High (theming system)

- [ ] **Mobile apps (iOS/Android)** - **P3** | **Very High**
  - Build native apps for venue owners (easier admin access)
  - Push notifications for new orders
  - Offline support (sync when back online)
  - **Business Value:** Better UX, app store discoverability
  - **Complexity:** Very High (React Native or native development)
  - **BUILD/KILL:** Likely KILL - web app is sufficient, focus on core SaaS

- [ ] **Integrations ecosystem** - **P3** | **High**
  - Integrate with POS systems (Square, Clover, Toast)
  - Integrate with reservation systems (OpenTable)
  - Webhooks for order events (send to kitchen display system)
  - **Business Value:** ENTERPRISE feature, reduces friction
  - **Complexity:** High (multiple integration partners)

### Operational Improvements

- [ ] **Multi-region deployment** - **P3** | **High**
  - Deploy to multiple regions (US, EU, Asia) for lower latency
  - Use Fly.io edge deployment or Cloudflare Workers
  - Database read replicas per region
  - **Business Value:** Global scalability
  - **Complexity:** High (data replication, consistency)

- [ ] **Advanced security** - **P3** | **Medium**
  - Implement 2FA for admin accounts
  - Add audit logs for all admin actions
  - Regular security audits and penetration testing
  - **Business Value:** ENTERPRISE compliance, trust
  - **Complexity:** Medium

---

## Quick Wins (Prioritized by Impact/Effort Ratio)

These tasks can be done anytime for immediate value with minimal effort:

1. **Add product search to admin panel** - **P2** | **Low** - Currently only on public menu
2. **Add bulk product import (CSV)** - **P2** | **Low** - Speed up menu creation for new venues
3. **Add product duplicate button** - **P2** | **Low** - Fast way to create similar products
4. **Add category reordering drag-and-drop** - **P2** | **Low** - Better UX than manual `displayOrder`
5. **Add "Copy QR Code Link" button** - **P2** | **Low** - Easier QR code sharing
6. **Add menu preview mode** - **P2** | **Low** - See public menu before publishing changes
7. **Add product stock notifications** - **P2** | **Low** - Alert when item marked out of stock
8. **Add dark mode for admin panel** - **P3** | **Low** - Nice-to-have, modern UX

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Infrastructure migration downtime** | High | Medium | Blue-green deployment, DNS TTL, thorough testing |
| **Data loss during migration** | Critical | Low | Full backups before migration, test on staging first |
| **Stripe payment failures** | High | Medium | Test with Stripe test mode, handle webhook retries |
| **User confusion on multi-tenant** | Medium | Medium | Clear onboarding, help documentation, support email |
| **Cost overrun on infrastructure** | Medium | Low | Set billing alerts, monitor usage, budget caps |
| **Slow customer adoption** | High | Medium | Marketing, referral program, free trial, venue feedback |
| **Competition (cheaper alternatives)** | High | High | Differentiate on UX, support, reliability, features |
| **Test failures blocking releases** | Medium | Low | Fix E2E flakiness, add retries, maintain test coverage |

---

## Success Metrics - Quarterly Targets

### Q1 2026 (Jan-Mar) - Phase 0-2

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Menu Load Time (p95)** | Unknown | <2s | Vercel Analytics / RUM |
| **Error Rate** | ~50% → <1% (fixed) | <0.5% | Sentry |
| **Uptime** | No SLA | 99.5% | UptimeRobot |
| **Active Venues** | 1 | 5 | Database query |
| **Daily Menu Views** | Unknown | 500 | ViewLog aggregation |
| **Infrastructure Cost** | ~$0 (free tier) | $20-40/month | Hosting dashboard |

### Q2 2026 (Apr-Jun) - Phase 3-4

| Metric | Q1 Target | Q2 Target | Measurement |
|--------|-----------|-----------|-------------|
| **Active Venues** | 5 | 20 | Database query |
| **Daily Menu Views** | 500 | 2,000 | ViewLog aggregation |
| **Paid Subscriptions** | 0 | 5 (25% of venues) | Subscription.status = 'active' |
| **MRR** | $0 | $145 (5 × $29) | Stripe dashboard |
| **Trial → Paid Conversion** | N/A | 20% | Analytics tracking |
| **Customer Churn Rate** | N/A | <5% | Subscription cancellations |

### Q3 2026 (Jul-Sep) - Scale

| Metric | Q2 Target | Q3 Target | Measurement |
|--------|-----------|-----------|-------------|
| **Active Venues** | 20 | 50 | Database query |
| **Daily Menu Views** | 2,000 | 5,000 | ViewLog aggregation |
| **Paid Subscriptions** | 5 | 15 (30% of venues) | Subscription.status = 'active' |
| **MRR** | $145 | $435 (15 × $29) | Stripe dashboard |
| **Customer Support Tickets** | N/A | <10/month | Support system |

---

## Appendix: Build/Kill Recommendations

### KILL (Remove These)

1. **Multi-currency support** - Adds complexity, most venues operate in single currency. Removed in commit 9db36fc. **Status:** KILLED ✓
2. **Slug field per product/category** - Removed in commit 59cc101 for categories. Consider same for products. **Status:** IN PROGRESS
3. **Legacy `category` string field on Product** - Redundant with `categoryId` relation. See Technical Debt. **Status:** PENDING KILL
4. **Mobile apps** - Web-first approach is sufficient, avoid app store complexity. **Status:** BACKLOG (DON'T BUILD)

### BUILD (High ROI)

1. **Analytics dashboard** - Low effort, high value for venue owners. **Priority:** Phase 3
2. **Multi-language menus** - Key differentiator, many venues serve international customers. **Priority:** Phase 3
3. **Subscription billing** - Core business model, critical for sustainability. **Priority:** Phase 4
4. **Venue onboarding flow** - Enables growth, necessary for multi-tenant SaaS. **Priority:** Phase 2

### DECIDE LATER (Need Customer Validation)

1. **Table ordering** - High effort, unclear demand. Survey venues first. **Status:** Conditional on 3+ venue requests
2. **Custom domains** - Nice for ENTERPRISE, but complex. Build only if paying customers request it. **Status:** Phase 4+ (if demanded)
3. **POS integrations** - High value for some, but partnership-dependent. Evaluate after 20+ venues. **Status:** Future consideration

---

## How to Use This Document

1. **For Development Team:** Pick tasks from current phase, check dependencies, update checkboxes as you complete work.
2. **For Product Manager:** Use this to plan sprints, track progress, and communicate roadmap to stakeholders.
3. **For Stakeholders:** See high-level phases and success metrics to understand product evolution.
4. **For New Contributors:** Read Phase 0 and Current Status to understand where the project is today.

**Update Frequency:** Review and update this document bi-weekly during sprint planning. Mark completed tasks with `[x]` and add new tasks as needed.

---

**Document Owner:** Development Team
**Last Major Update:** January 6, 2026 (Post-accessibility fix)
**Next Review:** January 20, 2026
