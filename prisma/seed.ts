import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_EMAIL_PLACEHOLDER = 'owner@example.com';
const DEFAULT_PASSWORD_PLACEHOLDER = 'Admin123!';

function resolveAdminCredentials() {
  const email = process.env.DEFAULT_ADMIN_EMAIL?.trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? '';

  if (!email) throw new Error('DEFAULT_ADMIN_EMAIL must be set before seeding.');
  if (!password) throw new Error('DEFAULT_ADMIN_PASSWORD must be set before seeding.');
  if (email === DEFAULT_EMAIL_PLACEHOLDER) {
    throw new Error('DEFAULT_ADMIN_EMAIL cannot use the example placeholder.');
  }
  if (password === DEFAULT_PASSWORD_PLACEHOLDER) {
    throw new Error('DEFAULT_ADMIN_PASSWORD cannot use the example placeholder.');
  }
  if (password.length < 12) {
    throw new Error('DEFAULT_ADMIN_PASSWORD must be at least 12 characters.');
  }

  return { email, password };
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

const tl = (value: number) => value * 100;

type ProductSeed = {
  name: string;
  priceTl: number;
  categoryKey: string;
  subCategoryKey?: string;
  description?: string;
};

function shortDescription(name: string, categoryName: string) {
  const lower = name.toLocaleLowerCase('tr-TR');
  if (categoryName.includes('Kahve')) return `${name}, özenle demlenen aromatik bir kahve seçeneğidir.`;
  if (categoryName.includes('Pizza')) return `${name}, taze malzemelerle hazırlanan doyurucu bir pizza seçeneğidir.`;
  if (categoryName.includes('Makarna')) return `${name}, özel sosuyla servis edilen sıcak bir makarna lezzetidir.`;
  if (categoryName.includes('Hamburger')) return `${name}, yanında garnitürle sunulan doyurucu bir burgerdir.`;
  if (categoryName.includes('Kahvaltı')) return `${name}, güne keyifli bir başlangıç için hazırlanan kahvaltı tabağıdır.`;
  if (categoryName.includes('Dondurma')) return `${name}, serinleten ve hafif bir tatlı alternatifidir.`;
  if (categoryName.includes('Ekstralar')) return `${name}, ana ürünlerin yanında tercih edilebilecek tamamlayıcı bir lezzettir.`;
  if (lower.includes('mojito') || lower.includes('limonata') || lower.includes('kokteyl')) {
    return `${name}, ferahlatıcı aromalarla hazırlanan soğuk bir içecektir.`;
  }
  if (lower.includes('smoothie') || lower.includes('frozen') || lower.includes('milkshake')) {
    return `${name}, meyve ve buz dengesiyle hazırlanan serin bir içecektir.`;
  }
  return `${name}, günlük taze ürünlerle hazırlanan özel bir menü seçeneğidir.`;
}

async function main() {
  const { email: adminEmail, password: adminPass } = resolveAdminCredentials();
  const hash = await bcrypt.hash(adminPass, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: hash, role: 'ADMIN' as const },
    create: { email: adminEmail, passwordHash: hash, role: 'ADMIN' as const },
  });

  const venue = await prisma.venue.upsert({
    where: { slug: 'ornek-kafe' },
    update: {
      name: '1453 OTTOMAN',
      announcement: 'Yeni menümüz yayında.',
    },
    create: {
      name: '1453 OTTOMAN',
      slug: 'ornek-kafe',
      announcement: 'Yeni menümüz yayında.',
    },
  });

  // Full reset for this venue.
  await prisma.product.deleteMany({ where: { venueId: venue.id } });
  await prisma.subCategory.deleteMany({ where: { venueId: venue.id } });
  await prisma.category.deleteMany({ where: { venueId: venue.id } });

  const categories = [
    { key: 'KAHVELER', name: 'Kahveler', slug: 'kahveler' },
    { key: 'SOGUK_KAHVELER', name: 'Soğuk Kahveler', slug: 'soguk-kahveler' },
    { key: 'SOGUK_BAR', name: 'Soğuk Bar', slug: 'soguk-bar' },
    { key: 'FROZEN_SMOOTHIE', name: 'Frozen & Smoothie', slug: 'frozen-smoothie' },
    { key: 'SOGUK_ICECEKLER', name: 'Soğuk İçecekler', slug: 'soguk-icecekler' },
    { key: 'MILKSHAKE', name: 'Milkshake', slug: 'milkshake' },
    { key: 'KAHVALTI', name: 'Kahvaltı', slug: 'kahvalti' },
    { key: 'HAMBURGER', name: 'Hamburger', slug: 'hamburger' },
    { key: 'MAKARNA', name: 'Makarna', slug: 'makarna' },
    { key: 'PIZZA', name: 'Pizza', slug: 'pizza' },
    { key: 'OSMANLI_MUTFAGI', name: 'Osmanlı Mutfağı', slug: 'osmanli-mutfagi' },
    { key: 'DONDURMA', name: 'Dondurma', slug: 'dondurma' },
    { key: 'EKSTRALAR', name: 'Ekstralar', slug: 'ekstralar' },
  ] as const;

  const subCategories = [
    { key: 'TURK_KAHVELERI', categoryKey: 'KAHVELER', name: 'Türk Kahveleri', slug: 'turk-kahveleri' },
    { key: 'ESPRESSO_BAZLI', categoryKey: 'KAHVELER', name: 'Espresso Bazlı', slug: 'espresso-bazli' },
    { key: 'FILTRE_HAZIR', categoryKey: 'KAHVELER', name: 'Filtre & Hazır Kahveler', slug: 'filtre-hazir-kahveler' },
    { key: 'LIMONATALAR', categoryKey: 'SOGUK_BAR', name: 'Limonatalar', slug: 'limonatalar' },
    { key: 'MOJITOLAR', categoryKey: 'SOGUK_BAR', name: 'Mojitolar', slug: 'mojitolar' },
    { key: 'KOKTEYLLER', categoryKey: 'SOGUK_BAR', name: 'Kokteyller', slug: 'kokteyller' },
    { key: 'FROZEN', categoryKey: 'FROZEN_SMOOTHIE', name: 'Frozen', slug: 'frozen' },
    { key: 'SMOOTHIE', categoryKey: 'FROZEN_SMOOTHIE', name: 'Smoothie', slug: 'smoothie' },
    { key: 'TAVUK_YEMEKLERI', categoryKey: 'OSMANLI_MUTFAGI', name: 'Tavuk Yemekleri', slug: 'tavuk-yemekleri' },
    { key: 'ET_YEMEKLERI', categoryKey: 'OSMANLI_MUTFAGI', name: 'Et Yemekleri', slug: 'et-yemekleri' },
  ] as const;

  const categoryIdByKey = new Map<string, string>();
  const categoryNameByKey = new Map<string, string>();
  for (const [index, category] of categories.entries()) {
    const created = await prisma.category.create({
      data: {
        venueId: venue.id,
        name: category.name,
        slug: category.slug,
        imageUrl: null,
        displayOrder: index,
        isVisible: true,
      },
      select: { id: true },
    });
    categoryIdByKey.set(category.key, created.id);
    categoryNameByKey.set(category.key, category.name);
  }

  const subCategoryIdByKey = new Map<string, string>();
  const subOrder = new Map<string, number>();
  for (const subCategory of subCategories) {
    const categoryId = categoryIdByKey.get(subCategory.categoryKey);
    if (!categoryId) throw new Error(`Missing category for ${subCategory.key}`);
    const current = subOrder.get(subCategory.categoryKey) ?? 0;

    const created = await prisma.subCategory.create({
      data: {
        venueId: venue.id,
        categoryId,
        name: subCategory.name,
        slug: subCategory.slug,
        displayOrder: current,
        isVisible: true,
      },
      select: { id: true },
    });
    subCategoryIdByKey.set(subCategory.key, created.id);
    subOrder.set(subCategory.categoryKey, current + 1);
  }

  const products: ProductSeed[] = [
    { name: 'Türk Kahvesi', priceTl: 120, categoryKey: 'KAHVELER', subCategoryKey: 'TURK_KAHVELERI' },
    { name: 'Dibek Kahvesi', priceTl: 120, categoryKey: 'KAHVELER', subCategoryKey: 'TURK_KAHVELERI' },
    { name: 'Menengiç Kahvesi', priceTl: 120, categoryKey: 'KAHVELER', subCategoryKey: 'TURK_KAHVELERI' },
    { name: 'Damla Sakızlı Türk Kahvesi', priceTl: 120, categoryKey: 'KAHVELER', subCategoryKey: 'TURK_KAHVELERI' },
    { name: 'Sütlü Türk Kahvesi', priceTl: 120, categoryKey: 'KAHVELER', subCategoryKey: 'TURK_KAHVELERI' },
    { name: 'Double Türk Kahvesi', priceTl: 140, categoryKey: 'KAHVELER', subCategoryKey: 'TURK_KAHVELERI' },

    { name: 'Espresso Single', priceTl: 90, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Espresso Double', priceTl: 120, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Americano', priceTl: 140, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Cappuccino', priceTl: 160, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Latte', priceTl: 150, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Karamel Latte', priceTl: 180, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Fındık Latte', priceTl: 160, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'White Mocha', priceTl: 170, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Mocha', priceTl: 160, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Flat White', priceTl: 140, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },
    { name: 'Karamel Macchiato', priceTl: 170, categoryKey: 'KAHVELER', subCategoryKey: 'ESPRESSO_BAZLI' },

    { name: 'Filtre Kahve', priceTl: 130, categoryKey: 'KAHVELER', subCategoryKey: 'FILTRE_HAZIR' },
    { name: 'Sütlü Filtre Kahve', priceTl: 150, categoryKey: 'KAHVELER', subCategoryKey: 'FILTRE_HAZIR' },
    { name: 'Hazır Kahve', priceTl: 95, categoryKey: 'KAHVELER', subCategoryKey: 'FILTRE_HAZIR' },
    { name: 'Sütlü Hazır Kahve', priceTl: 130, categoryKey: 'KAHVELER', subCategoryKey: 'FILTRE_HAZIR' },

    { name: 'Cold Brew', priceTl: 130, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Cold Brew Sütlü', priceTl: 180, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Espresso Freddo', priceTl: 130, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Iced Latte', priceTl: 160, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Iced Americano', priceTl: 140, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Iced Mocha', priceTl: 160, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Iced White Mocha', priceTl: 180, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Iced Karamel Macchiato', priceTl: 170, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Iced Lotus Latte', priceTl: 200, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Frappe', priceTl: 150, categoryKey: 'SOGUK_KAHVELER' },
    { name: 'Aromalı Frappe', priceTl: 180, categoryKey: 'SOGUK_KAHVELER' },

    { name: 'Klasik Limonata', priceTl: 120, categoryKey: 'SOGUK_BAR', subCategoryKey: 'LIMONATALAR' },
    { name: 'Çilek / Mango / Nane Limonata', priceTl: 120, categoryKey: 'SOGUK_BAR', subCategoryKey: 'LIMONATALAR' },
    { name: 'Purple Lemonade', priceTl: 150, categoryKey: 'SOGUK_BAR', subCategoryKey: 'LIMONATALAR' },
    { name: 'Hibiscus', priceTl: 110, categoryKey: 'SOGUK_BAR', subCategoryKey: 'LIMONATALAR' },

    { name: 'Klasik Mojito', priceTl: 200, categoryKey: 'SOGUK_BAR', subCategoryKey: 'MOJITOLAR' },
    { name: 'Çilek / Böğürtlen / Orman Meyveli Mojito', priceTl: 200, categoryKey: 'SOGUK_BAR', subCategoryKey: 'MOJITOLAR' },
    { name: 'Mojito Red Bull', priceTl: 200, categoryKey: 'SOGUK_BAR', subCategoryKey: 'MOJITOLAR' },

    { name: 'Green Garden', priceTl: 145, categoryKey: 'SOGUK_BAR', subCategoryKey: 'KOKTEYLLER' },
    { name: 'Palm Tree', priceTl: 145, categoryKey: 'SOGUK_BAR', subCategoryKey: 'KOKTEYLLER' },
    { name: 'Purple Zen', priceTl: 145, categoryKey: 'SOGUK_BAR', subCategoryKey: 'KOKTEYLLER' },
    { name: 'Sugar Bomb', priceTl: 145, categoryKey: 'SOGUK_BAR', subCategoryKey: 'KOKTEYLLER' },
    { name: 'Summer Garden', priceTl: 145, categoryKey: 'SOGUK_BAR', subCategoryKey: 'KOKTEYLLER' },

    { name: 'Frozen Çilek', priceTl: 210, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'FROZEN' },
    { name: 'Frozen Karpuz', priceTl: 180, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'FROZEN' },
    { name: 'Frozen Karadut', priceTl: 180, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'FROZEN' },
    { name: 'Frozen Tropic', priceTl: 150, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'FROZEN' },
    { name: 'Frozen Ananas Mango', priceTl: 210, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'FROZEN' },

    { name: 'Smoothie Çilek', priceTl: 160, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'SMOOTHIE' },
    { name: 'Smoothie Mango', priceTl: 160, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'SMOOTHIE' },
    { name: 'Smoothie Yaban Mersini', priceTl: 180, categoryKey: 'FROZEN_SMOOTHIE', subCategoryKey: 'SMOOTHIE' },

    { name: 'Coca-Cola', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Coca-Cola Zero', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Coca-Cola Şekersiz', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Fanta', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Sprite', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Fuse Tea', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Cappy', priceTl: 75, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Ayran', priceTl: 55, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Naneli Ayran', priceTl: 55, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Soda', priceTl: 50, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Meyveli Soda', priceTl: 60, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Ev Yapımı Limonata', priceTl: 110, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Red Bull', priceTl: 120, categoryKey: 'SOGUK_ICECEKLER' },
    { name: 'Su (Cam Şişe)', priceTl: 25, categoryKey: 'SOGUK_ICECEKLER' },

    { name: 'Çikolata Milkshake', priceTl: 180, categoryKey: 'MILKSHAKE' },
    { name: 'Çilek Milkshake', priceTl: 180, categoryKey: 'MILKSHAKE' },
    { name: 'Fındık Çikolata Milkshake', priceTl: 180, categoryKey: 'MILKSHAKE' },
    { name: 'Lotus Milkshake', priceTl: 200, categoryKey: 'MILKSHAKE' },
    { name: 'Oreo Milkshake', priceTl: 200, categoryKey: 'MILKSHAKE' },

    { name: 'Has Kahvaltı', priceTl: 350, categoryKey: 'KAHVALTI' },
    { name: 'Mini Kahvaltı', priceTl: 150, categoryKey: 'KAHVALTI' },
    { name: 'Serpme Kahvaltı', priceTl: 650, categoryKey: 'KAHVALTI' },
    { name: 'Saraylı Serpme', priceTl: 800, categoryKey: 'KAHVALTI' },

    { name: 'Hamburger', priceTl: 310, categoryKey: 'HAMBURGER' },
    { name: 'Gurme', priceTl: 320, categoryKey: 'HAMBURGER' },
    { name: 'Osmanlı', priceTl: 375, categoryKey: 'HAMBURGER' },
    { name: 'Türk İşi', priceTl: 350, categoryKey: 'HAMBURGER' },
    { name: 'Adabeyi', priceTl: 380, categoryKey: 'HAMBURGER' },

    { name: 'Spagetti Carbonara', priceTl: 300, categoryKey: 'MAKARNA' },
    { name: 'Penne Alfredo', priceTl: 350, categoryKey: 'MAKARNA' },
    { name: 'Yoğurtlu Penne', priceTl: 220, categoryKey: 'MAKARNA' },
    { name: 'Köri Soslu Penne', priceTl: 350, categoryKey: 'MAKARNA' },

    { name: 'Margarita', priceTl: 340, categoryKey: 'PIZZA' },
    { name: 'Karışık', priceTl: 380, categoryKey: 'PIZZA' },
    { name: '4 Peynir', priceTl: 350, categoryKey: 'PIZZA' },
    { name: 'Tavuklu', priceTl: 380, categoryKey: 'PIZZA' },
    { name: 'Ton Balıklı', priceTl: 400, categoryKey: 'PIZZA' },
    { name: 'Chef Pizza', priceTl: 500, categoryKey: 'PIZZA' },

    { name: 'Sultan', priceTl: 380, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'TAVUK_YEMEKLERI' },
    { name: 'Haseki', priceTl: 360, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'TAVUK_YEMEKLERI' },
    { name: 'Mexican Tavuk', priceTl: 320, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'TAVUK_YEMEKLERI' },
    { name: 'Tavuk Nazik', priceTl: 400, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'TAVUK_YEMEKLERI' },

    { name: 'Nazik Et', priceTl: 500, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'ET_YEMEKLERI' },
    { name: 'Izgara Köfte', priceTl: 380, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'ET_YEMEKLERI' },
    { name: 'Hünkar Beğendi', priceTl: 550, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'ET_YEMEKLERI' },
    { name: 'Bonfile (Soslu)', priceTl: 600, categoryKey: 'OSMANLI_MUTFAGI', subCategoryKey: 'ET_YEMEKLERI' },

    { name: 'Tek Top', priceTl: 50, categoryKey: 'DONDURMA' },
    { name: 'Özel Çeşitler', priceTl: 200, categoryKey: 'DONDURMA' },

    { name: 'Patates Kızartması', priceTl: 65, categoryKey: 'EKSTRALAR' },
    { name: 'Soğan Halkası', priceTl: 75, categoryKey: 'EKSTRALAR' },
    { name: 'Sos', priceTl: 25, categoryKey: 'EKSTRALAR' },
  ];

  const usedSlugs = new Set<string>();
  for (const item of products) {
    const categoryId = categoryIdByKey.get(item.categoryKey);
    if (!categoryId) throw new Error(`Missing category id for ${item.categoryKey}`);

    const subCategoryId = item.subCategoryKey
      ? subCategoryIdByKey.get(item.subCategoryKey) ?? null
      : null;

    const categorySlug = categories.find((c) => c.key === item.categoryKey)?.slug ?? item.categoryKey.toLowerCase();
    const subSlug = item.subCategoryKey
      ? subCategories.find((s) => s.key === item.subCategoryKey)?.slug ?? item.subCategoryKey.toLowerCase()
      : 'genel';
    const base = slugify(`${categorySlug}-${subSlug}-${item.name}`) || `urun-${usedSlugs.size + 1}`;
    let slug = base;
    let index = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${index++}`;
    }
    usedSlugs.add(slug);

    await prisma.product.create({
      data: {
        venueId: venue.id,
        name: item.name,
        slug,
        category: categorySlug,
        categoryId,
        subCategoryId,
        description: item.description ?? shortDescription(item.name, categoryNameByKey.get(item.categoryKey) ?? ''),
        priceCents: tl(item.priceTl),
        imageUrl: null,
        isActive: true,
        isInStock: true,
      },
    });
  }
}

main()
  .then(() => {
    console.log('Seed completed ✅');
  })
  .catch((e) => {
    console.error('Seed failed ❌', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
