import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_EMAIL_PLACEHOLDER = 'owner@example.com';
const DEFAULT_PASSWORD_PLACEHOLDER = 'Admin123!';

function resolveAdminCredentials() {
  const email = process.env.DEFAULT_ADMIN_EMAIL?.trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? '';

  if (!email) {
    throw new Error('DEFAULT_ADMIN_EMAIL must be set before seeding.');
  }
  if (!password) {
    throw new Error('DEFAULT_ADMIN_PASSWORD must be set before seeding.');
  }
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

async function main() {
  // --- Admin (upsert) ---
  const { email: adminEmail, password: adminPass } = resolveAdminCredentials();
  const hash = await bcrypt.hash(adminPass, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: hash, role: 'ADMIN' as any },
    create: { email: adminEmail, passwordHash: hash, role: 'ADMIN' as any },
  });

  // --- Venue (upsert by slug) ---
  const venue = await prisma.venue.upsert({
    where: { slug: 'ornek-kafe' },
    update: {
      name: 'Cleopatra Coffee',
    },
    create: {
      name: 'Cleopatra Coffee',
      slug: 'ornek-kafe',
      announcement: 'Bugün filtre kahve 39₺!',
    },
  });

  // --- Cleanup existing data for this venue ---
  // delete products first (they depend on categories)
  await prisma.product.deleteMany({ where: { venueId: venue.id } });
  await prisma.category.deleteMany({ where: { venueId: venue.id } });

  // --- Categories (create fresh) ---
  const categoriesConfig = [
    {
      key: 'HOT',
      name: 'Sıcak İçecekler',
      slug: 'hot',
      imageUrl: '/images/categories/coffee.jpg',
    },
    {
      key: 'COLD',
      name: 'Soğuk İçecekler',
      slug: 'cold',
      imageUrl: '/images/categories/sogukIcecekler.jpg',
    },
    {
      key: 'DESSERT',
      name: 'Tatlılar',
      slug: 'dessert',
      imageUrl: '/images/categories/dessert.jpg',
    },
  ] as const;

  const categoryIdMap = {} as Record<(typeof categoriesConfig)[number]['key'], string>;

  for (const [index, config] of categoriesConfig.entries()) {
    const created = await prisma.category.create({
      data: {
        venueId: venue.id,
        name: config.name,
        slug: config.slug,
        imageUrl: config.imageUrl,
        displayOrder: index,
        isVisible: true,
      },
    });
    categoryIdMap[config.key] = created.id;
  }

  const products = [
    { name: 'Ra', description: 'Ra', priceCents: 18000, imageUrl: '/images/products/1.png', categoryKey: 'COLD' },
    { name: 'Ice Berry-White Mocha', description: 'Ice Berry-White Mocha', priceCents: 17000, imageUrl: '/images/products/2.png', categoryKey: 'COLD' },
    { name: 'Isis', description: 'Isis', priceCents: 18000, imageUrl: '/images/products/3.png', categoryKey: 'HOT' },
    { name: 'Caramel Frappe', description: 'Caramel Frappe', priceCents: 17000, imageUrl: '/images/products/4.png', categoryKey: 'COLD' },
    { name: 'White Mocha Frappe', description: 'White Mocha Frappe', priceCents: 17000, imageUrl: '/images/products/5.png', categoryKey: 'COLD' },
    { name: 'Anubis', description: 'Anubis', priceCents: 18000, imageUrl: '/images/products/6.png', categoryKey: 'COLD' },
    { name: 'Çikolatalı Mocha Frappe', description: 'Çikolatalı Mocha Frappe', priceCents: 17000, imageUrl: '/images/products/7.png', categoryKey: 'COLD' },
    { name: 'Ice Americano', description: 'Ice Americano', priceCents: 12000, imageUrl: '/images/products/8.png', categoryKey: 'COLD' },
    { name: 'Bastet', description: 'Bastet', priceCents: 18000, imageUrl: '/images/products/9.png', categoryKey: 'COLD' },
    { name: 'Ice Mocha', description: 'Ice Mocha', priceCents: 16000, imageUrl: '/images/products/10.png', categoryKey: 'COLD' },
    { name: 'Ice Flat White', description: 'Ice Flat White', priceCents: 12000, imageUrl: '/images/products/11.png', categoryKey: 'COLD' },
    { name: 'Ice Filtre', description: 'Ice Filtre', priceCents: 11000, imageUrl: '/images/products/12.png', categoryKey: 'COLD' },
    { name: 'Ice Latte', description: 'Ice Latte', priceCents: 13000, imageUrl: '/images/products/13.png', categoryKey: 'COLD' },
    { name: 'Salted Caramel Latte', description: 'Salted Caramel Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Hazelnut Latte', description: 'Hazelnut Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Pekan Cevizli Latte', description: 'Pekan Cevizli Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Toffeenut Latte', description: 'Toffeenut Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Vanilya Latte', description: 'Vanilya Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Coconut Latte', description: 'Coconut Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Caramel Latte', description: 'Caramel Latte', priceCents: 14000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'White Mocha', description: 'White Mocha', priceCents: 14000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Cookie Latte', description: 'Cookie Latte', priceCents: 13000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Mocha', description: 'Mocha', priceCents: 14000, imageUrl: '/images/products/19.png', categoryKey: 'HOT' },
    { name: 'Americano', description: 'Americano', priceCents: 10000, imageUrl: '/images/products/15.png', categoryKey: 'HOT' },
    { name: 'Flat White', description: 'Flat White', priceCents: 11000, imageUrl: '/images/products/16.png', categoryKey: 'HOT' },
    { name: 'Cappucino', description: 'Cappucino', priceCents: 12000, imageUrl: '/images/products/17.png', categoryKey: 'HOT' },
    { name: 'Latte', description: 'Latte', priceCents: 12000, imageUrl: '/images/products/18.png', categoryKey: 'HOT' },
    { name: 'Filtre', description: 'Filtre', priceCents: 9000, imageUrl: '/images/products/20.png', categoryKey: 'HOT' },
    { name: 'Espresso', description: 'Espresso', priceCents: 8000, imageUrl: '/images/products/21.png', categoryKey: 'HOT' },
    { name: 'White Cream Roll Kruvasan', description: 'White Cream Roll Kruvasan', priceCents: 15000, imageUrl: '/images/products/22.png', categoryKey: 'DESSERT' },
    { name: 'Ice Cream Kruvasan', description: 'Ice Cream Kruvasan', priceCents: 15000, imageUrl: '/images/products/23.png', categoryKey: 'DESSERT' },
    { name: 'Cleopatra Cup', description: 'Cleopatra Cup', priceCents: 10000, imageUrl: '/images/products/24.png', categoryKey: 'DESSERT' },
    { name: 'Çikolatalı Cleopatra Kruvasan', description: 'Çikolatalı Cleopatra Kruvasan', priceCents: 15000, imageUrl: '/images/products/26.png', categoryKey: 'DESSERT' },
    { name: 'Çikolatalı Meyveli Roll Kruvasan', description: 'Çikolatalı Meyveli Roll Kruvasan', priceCents: 15000, imageUrl: '/images/products/27.png', categoryKey: 'DESSERT' },
    { name: 'Çikolatalı Meyveli Cleopatra Kruvasan', description: 'Çikolatalı Meyveli Cleopatra Kruvasan', priceCents: 15000, imageUrl: '/images/products/28.png', categoryKey: 'DESSERT' },
    { name: 'Orman Meyveli Mascarpone Kruvasan', description: 'Orman Meyveli Mascarpone Kruvasan', priceCents: 15000, imageUrl: '/images/products/29.png', categoryKey: 'DESSERT' },
    { name: 'Kremalı Meyveli Cleopatra Kruvasan', description: 'Kremalı Meyveli Cleopatra Kruvasan', priceCents: 15000, imageUrl: '/images/products/30.png', categoryKey: 'DESSERT' },
    { name: 'Kremalı Orman Meyveli Cleopatra Kruvasan', description: 'Kremalı Orman Meyveli Cleopatra Kruvasan', priceCents: 15000, imageUrl: '/images/products/31.png', categoryKey: 'DESSERT' },
    // Tatlılar (DESSERT)
    { name: 'Simit', description: 'Simit', priceCents: 3000, imageUrl: '/images/products/39.png', categoryKey: 'DESSERT' },
    { name: 'Havuçlu Kek', description: 'Havuçlu Kek', priceCents: 12000, imageUrl: '/images/products/35.png', categoryKey: 'DESSERT' },
    { name: 'Browni', description: 'Browni', priceCents: 17000, imageUrl: '/images/products/36.png', categoryKey: 'DESSERT' },
    { name: 'Apple Pie', description: 'Apple Pie', priceCents: 17000, imageUrl: '/images/products/33.png', categoryKey: 'DESSERT' }, // fiyat eksik
    { name: 'Frambuaz Cheesecake', description: 'Frambuaz Cheesecake', priceCents: 17000, imageUrl: '/images/products/34.png', categoryKey: 'DESSERT' },
    { name: 'San Sebastian', description: 'San Sebastian', priceCents: 17000, imageUrl: '/images/products/37.png', categoryKey: 'DESSERT' },
    { name: 'Antep Fıstıklı Kadayıflı', description: 'Antep Fıstıklı Kadayıflı', priceCents: 16000, imageUrl: '/images/products/40.png', categoryKey: 'DESSERT' },
    { name: 'Devil’s Kek', description: 'Devil’s Kek', priceCents: 17000, imageUrl: '/images/products/32.png', categoryKey: 'DESSERT' },
    { name: 'Limonlu Cheesecake', description: 'Limonlu Cheesecake', priceCents: 17000, imageUrl: '/images/products/38.png', categoryKey: 'DESSERT' },
    { name: 'Makaron (Adet)', description: 'Makaron Adet', priceCents: 3000, imageUrl: '/images/products/41.png', categoryKey: 'DESSERT' },
    { name: 'Makaron (Porsiyon)', description: 'Makaron Porsiyon', priceCents: 10000, imageUrl: '/images/products/41.png', categoryKey: 'DESSERT' },

    // Brunch & Atıştırmalıklar (BRUNCH)
  
    // Soğuk İçecekler (COLD)
    { name: 'Coca Cola Cam Şişe', description: 'Coca Cola Cam Şişe', priceCents: 7000, imageUrl: '/images/products/48.png', categoryKey: 'COLD' },
    { name: 'Coca Cola Zero Sugar Cam Şişe', description: 'Coca Cola Zero Sugar Cam Şişe', priceCents: 7000, imageUrl: '/images/products/47.png', categoryKey: 'COLD' },
    { name: 'Fanta Cam Şişe', description: 'Fanta Cam Şişe', priceCents: 7000, imageUrl: '/images/products/46.png', categoryKey: 'COLD' },
    { name: 'Cappy Vişne Cam Şişe', description: 'Cappy Vişne Cam Şişe', priceCents: 7000, imageUrl: '/images/products/45.png', categoryKey: 'COLD' },
    { name: 'Cappy Şeftali Cam', description: 'Cappy Şeftali Cam', priceCents: 7000, imageUrl: '/images/products/44.png', categoryKey: 'COLD' },
    { name: 'Fuse Tea Şeftali Kutu', description: 'Fuse Tea Şeftali Kutu', priceCents: 7000, imageUrl: '/images/products/43.png', categoryKey: 'COLD' },
    { name: 'Fuse Tea Mango-Ananas Kutu', description: 'Fuse Tea Mango-Ananas Kutu', priceCents: 7000, imageUrl: '/images/products/49.png', categoryKey: 'COLD' },
    { name: 'Damla Sade Soda 200 ml', description: 'Damla Sade Soda 200 ml', priceCents: 2500, imageUrl: '/images/products/42.png', categoryKey: 'COLD' },
    { name: 'Beypazarı Sade Soda 20cl', description: 'Beypazarı Sade Soda 20cl', priceCents: 2500, imageUrl: '/images/products/50.png', categoryKey: 'COLD' },
    { name: 'Damla Cam Şişe Su 33cl', description: 'Damla Cam Şişe Su 33cl', priceCents: 4500, imageUrl: '/images/products/51.png', categoryKey: 'COLD' },
  ];

  for (const p of products) {
    const categoryId = categoryIdMap[p.categoryKey as keyof typeof categoryIdMap];
    await prisma.product.create({
      data: {
        venueId: venue.id,
        name: p.name,
        slug: p.name.toLowerCase().replace(/\s+/g, '-'),
        description: p.description,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        isActive: true,
        isInStock: true,
        category: p.categoryKey,
        categoryId,
      },
    });
  }

}

main()
  .catch((e) => {
    console.error('Seed failed ❌', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
