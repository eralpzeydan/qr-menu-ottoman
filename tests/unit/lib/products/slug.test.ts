import { describe, it, expect } from 'vitest';
import { toProductSlug } from '@/lib/products/slug';

describe('toProductSlug', () => {
  it('normalizes whitespace and casing', () => {
    expect(toProductSlug('  Latte Deluxe  ')).toBe('latte-deluxe');
  });

  it('removes unsafe characters and accents', () => {
    expect(toProductSlug('Çilekli*#Latte!')).toBe('cilekli-latte');
  });
});
