import { describe, it, expect } from 'vitest';
import { loginSchema, productCreateSchema, productPatchSchema, productPriceChangeSchema } from '@/lib/schemas';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const parsed = loginSchema.parse({ email: 'test@example.com', password: 'secret1' });
    expect(parsed).toEqual({ email: 'test@example.com', password: 'secret1' });
  });

  it('rejects invalid email and short password', () => {
    const res = loginSchema.safeParse({ email: 'invalid', password: '123' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map(issue => issue.path.join('.'))).toEqual(['email', 'password']);
    }
  });
});

describe('productCreateSchema', () => {
  const base = {
    venueId: 'venue-1',
    name: 'Iced Coffee',
    category: 'COLD',
    priceCents: 1500,
  };

  it('accepts full payload and keeps optional fields', () => {
    const parsed = productCreateSchema.parse({
      ...base,
      description: 'notes',
      isActive: false,
      isInStock: false,
      dietTags: ['vegan', 'vegetarian'],
    });
    expect(parsed).toMatchObject({
      venueId: 'venue-1',
      dietTags: ['vegan', 'vegetarian'],
      isActive: false,
      isInStock: false,
    });
  });

  it('rejects invalid diet tags or negative price', () => {
    const res = productCreateSchema.safeParse({
      ...base,
      priceCents: -10,
      dietTags: [''],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some(issue => issue.path.includes('priceCents'))).toBe(true);
    }
  });

  it('requires either category value or categoryId', () => {
    const res = productCreateSchema.safeParse({ venueId: 'v1', name: 'Latte', priceCents: 1000 });
    expect(res.success).toBe(false);
  });
});

describe('productPatchSchema', () => {
  it('allows partial updates', () => {
    const parsed = productPatchSchema.parse({ name: 'New', isActive: false });
    expect(parsed).toEqual({ name: 'New', isActive: false });
  });

  it('rejects invalid price', () => {
    const res = productPatchSchema.safeParse({ priceCents: -1 });
    expect(res.success).toBe(false);
  });
});

describe('productPriceChangeSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = productPriceChangeSchema.parse({ newPriceCents: 2500, reason: 'Stok maliyeti arttı' });
    expect(parsed).toEqual({ newPriceCents: 2500, reason: 'Stok maliyeti arttı' });
  });

  it('rejects invalid payloads', () => {
    const res = productPriceChangeSchema.safeParse({ newPriceCents: -5, reason: '' });
    expect(res.success).toBe(false);
  });
});
