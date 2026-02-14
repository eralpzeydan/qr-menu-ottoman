import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Geçersiz e-posta'),
  password: z.string().min(6, 'En az 6 karakter')
});

const categoryValue = z.string().trim().min(1, 'Kategori zorunlu').max(64);
const dietTagValue = z.string().trim().min(1).max(32);

export const productCreateSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1, 'İsim zorunlu'),
  slug: z.string().min(1).optional(),
  category: categoryValue.optional(),
  categoryId: z.string().trim().min(1).optional(),
  subCategoryId: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  isActive: z.boolean().optional(),
  isInStock: z.boolean().optional(),
  dietTags: z.array(dietTagValue).max(8).optional()
}).refine((data) => Boolean(data.category || data.categoryId), {
  message: 'Kategori zorunlu',
  path: ['category']
});

export const productPatchSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  category: categoryValue.optional(),
  categoryId: z.string().trim().min(1).optional(),
  subCategoryId: z.string().trim().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isInStock: z.boolean().optional(),
  dietTags: z.array(dietTagValue).max(8).optional()
});

export const productPriceChangeSchema = z.object({
  newPriceCents: z.number().int().min(0),
  reason: z.string().trim().min(2).max(200),
});

export const categoryCreateSchema = z.object({
  venueId: z.string().trim().min(1, 'Mekan zorunlu'),
  name: z.string().trim().min(1, 'İsim zorunlu').max(100),
  imageUrl: z.string().trim().min(1).max(512).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

export const subCategoryCreateSchema = z.object({
  venueId: z.string().trim().min(1, 'Mekan zorunlu'),
  categoryId: z.string().trim().min(1, 'Kategori zorunlu'),
  name: z.string().trim().min(1, 'İsim zorunlu').max(100),
  displayOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});
