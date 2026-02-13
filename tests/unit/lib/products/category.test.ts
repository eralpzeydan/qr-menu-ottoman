import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = vi.hoisted(() => ({
  category: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma }));

import { resolveCategorySelection } from '@/lib/products/category';

describe('resolveCategorySelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.category.findUnique.mockReset();
    prisma.category.findFirst.mockReset();
  });

  it('returns record data when categoryId matches', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c-1', slug: 'hot', name: 'Hot Drinks' });

    const result = await resolveCategorySelection({ categoryId: 'c-1', category: '' });

    expect(result).toEqual({ categoryId: 'c-1', categoryValue: 'hot' });
    expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { id: 'c-1' } });
  });

  it('throws 400 when categoryId not found', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(resolveCategorySelection({ categoryId: 'missing', category: undefined })).rejects.toMatchObject({
      message: 'Kategori bulunamadı',
      status: 400,
    });
  });

  it('matches existing record by slug or name when only category value is provided', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'c-2', slug: 'dessert', name: 'Tatlılar' });

    const result = await resolveCategorySelection({ category: 'Dessert' });

    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ slug: 'dessert' }, { name: 'Dessert' }] },
    });
    expect(result).toEqual({ categoryId: 'c-2', categoryValue: 'dessert' });
  });

  it('returns provided value when category does not exist yet', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    const result = await resolveCategorySelection({ category: '  New & Shiny  ' });

    expect(result).toEqual({ categoryId: null, categoryValue: 'New & Shiny' });
  });

  it('throws 400 when both categoryId and category are missing', async () => {
    await expect(resolveCategorySelection({ category: '   ' })).rejects.toMatchObject({
      message: 'Kategori zorunlu',
      status: 400,
    });
  });
});
