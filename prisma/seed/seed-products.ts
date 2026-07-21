import prisma from "../../src/config/prisma.js";

const categoriesData = [
  { name: 'Rings', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600' },
  { name: 'Necklaces', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600' },
  { name: 'Bracelets', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600' },
  { name: 'Earrings', image: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=600' },
  { name: 'Solitaires', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600' },
];

const brandsData = [
  'Aura Ornaments',
  'Classic Carats',
  'Royal Castings',
  'Diva Diamonds',
  'Prestige Gold',
];

const productsData = [
  {
    id: '1',
    name: 'Classic Solitaire Diamond Ring',
    price: 49999,
    originalPrice: 55000,
    description: 'A stunning brilliant-cut 1-carat round diamond set in a classic 18K white gold band. A timeless declaration of elegance.',
    images: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800',
    ],
    category: 'Solitaires',
    brand: 'Aura Ornaments',
    rating: 4.9,
    reviews: 42,
    sizes: ['5', '6', '7', '8', '9'],
    colors: [
      { name: '18K White Gold', hex: '#E5E4E2' },
      { name: '18K Yellow Gold', hex: '#D4AF37' },
    ],
    tags: ['ring', 'solitaire', 'diamond', '18k'],
    inStock: true,
    isNew: true,
    netWeight: '2.5g',
  },
  {
    id: '2',
    name: 'Golden Filigree Pendant Necklace',
    price: 29999,
    originalPrice: 32000,
    description: 'An ornate 22K yellow gold pendant displaying traditional Indian filigree patterns. Comes with a matching gold chain.',
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800',
    ],
    category: 'Necklaces',
    brand: 'Royal Castings',
    rating: 4.8,
    reviews: 18,
    sizes: ['16 inches', '18 inches', '20 inches'],
    colors: [
      { name: '22K Gold', hex: '#D4AF37' },
    ],
    tags: ['necklace', 'pendant', 'gold', 'filigree'],
    inStock: true,
    netWeight: '8.2g',
  },
  {
    id: '3',
    name: 'Dazzling Diamond Tennis Bracelet',
    price: 89999,
    originalPrice: 95000,
    description: 'A spectacular link bracelet set with a continuous line of individually certified brilliant-cut diamonds in 18K rose gold.',
    images: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800',
    ],
    category: 'Bracelets',
    brand: 'Diva Diamonds',
    rating: 5.0,
    reviews: 12,
    sizes: ['6.5 inches', '7 inches'],
    colors: [
      { name: '18K Rose Gold', hex: '#B76E79' },
      { name: '18K White Gold', hex: '#E5E4E2' },
    ],
    tags: ['bracelet', 'tennis', 'diamond', 'rose gold'],
    inStock: true,
    isNew: true,
    netWeight: '12.5g',
  },
  {
    id: '4',
    name: 'Aura Premium Drop Earrings',
    price: 39999,
    originalPrice: 45000,
    description: 'Exquisite drop earrings showcasing pear-cut emeralds surrounded by pave-set diamond halos in 18K yellow gold.',
    images: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800',
    ],
    category: 'Earrings',
    brand: 'Aura Ornaments',
    rating: 4.7,
    reviews: 25,
    sizes: ['One Size'],
    colors: [
      { name: '18K Yellow Gold', hex: '#D4AF37' },
    ],
    tags: ['earrings', 'emerald', 'diamond', 'gold'],
    inStock: true,
    isSale: true,
    netWeight: '5.4g',
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function main() {
  console.log('Seeding mock categories, brands, and products...');

  // 1. Seed Categories
  const categoryMap = new Map<string, string>(); // name -> id
  for (const cat of categoriesData) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name },
    });
    if (existing) {
      categoryMap.set(cat.name, existing.id);
    } else {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          image: cat.image,
          slug: slugify(cat.name),
        },
      });
      categoryMap.set(cat.name, created.id);
    }
  }

  // 2. Seed Brands
  const brandMap = new Map<string, string>(); // name -> id
  for (const bName of brandsData) {
    const existing = await prisma.brand.findUnique({
      where: { name: bName },
    });
    if (existing) {
      brandMap.set(bName, existing.id);
    } else {
      const created = await prisma.brand.create({
        data: {
          name: bName,
          slug: slugify(bName),
          isActive: true,
        },
      });
      brandMap.set(bName, created.id);
    }
  }

  // 3. Seed Products
  for (const p of productsData) {
    const categoryId = categoryMap.get(p.category);
    if (!categoryId) {
      console.warn(`Category not found for product ${p.name}: ${p.category}`);
      continue;
    }
    const brandId = p.brand ? brandMap.get(p.brand) : null;

    const existingProduct = await prisma.product.findUnique({
      where: { id: p.id },
    });

    if (existingProduct) {
      console.log(`Product "${p.name}" (ID: ${p.id}) already exists. Updating...`);
      await prisma.product.update({
        where: { id: p.id },
        data: {
          name: p.name,
          price: p.price,
          discountPrice: p.originalPrice || null, // map originalPrice to discountPrice if applicable
          description: p.description,
          image: p.images[0] || '',
          images: p.images,
          sizes: p.sizes,
          colors: p.colors,
          categoryId,
          brandId,
          quantity: 50,
          rating: p.rating,
          numReviews: p.reviews,
        },
      });
    } else {
      console.log(`Creating product "${p.name}" (ID: ${p.id})...`);
      await prisma.product.create({
        data: {
          id: p.id,
          name: p.name,
          price: p.price,
          discountPrice: p.originalPrice || null,
          description: p.description,
          image: p.images[0] || '',
          images: p.images,
          sizes: p.sizes,
          colors: p.colors,
          categoryId,
          brandId,
          quantity: 50,
          rating: p.rating,
          numReviews: p.reviews,
        },
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
