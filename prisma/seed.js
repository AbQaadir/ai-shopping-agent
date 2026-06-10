const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const suppliersData = [
  {
    name: "Beijing Liyi Technology Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 1,
    reorderRate: 85.0,
    rating: 4.8,
  },
  {
    name: "Henan Haiku Outdoor Products Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 1,
    reorderRate: 78.5,
    rating: 4.6,
  },
  {
    name: "YIWU FULLYUAN DAILY SUPPLIES CO.",
    countryCode: "CN",
    yearsOnPlatform: 1,
    reorderRate: 92.0,
    rating: 4.9,
  },
  {
    name: "Langfang Jinzhao Stationery Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 5,
    reorderRate: 88.0,
    rating: 4.7,
  },
  {
    name: "CIXI RUNFENG COMMODITY CO.",
    countryCode: "CN",
    yearsOnPlatform: 10,
    reorderRate: 95.5,
    rating: 4.9,
  },
  {
    name: "Wuhan Pioneersky Cultural Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 1,
    reorderRate: 72.0,
    rating: 4.5,
  },
  {
    name: "Ningbo Outdo Hiking Gear Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 2,
    reorderRate: 90.0,
    rating: 4.8,
  },
  {
    name: "Hangzhou Joy Outdoor Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 4,
    reorderRate: 81.5,
    rating: 4.6,
  },
  {
    name: "Shaoxing Leisure Products Factory",
    countryCode: "CN",
    yearsOnPlatform: 3,
    reorderRate: 94.0,
    rating: 4.9,
  },
  {
    name: "Tianjin Sports Gear Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 1,
    reorderRate: 68.0,
    rating: 4.4,
  },
  {
    name: "Yiwu Children Goods Import & Export",
    countryCode: "CN",
    yearsOnPlatform: 8,
    reorderRate: 91.0,
    rating: 4.8,
  },
  {
    name: "Foshan Goldway Furniture Co., Ltd.",
    countryCode: "CN",
    yearsOnPlatform: 6,
    reorderRate: 84.5,
    rating: 4.7,
  }
];

const productsData = [
  {
    title: "Folding Moon Chair Portable Breathable Mesh Backrest Seat for Outdoor Camping",
    priceRange: "$3.40 - $3.60",
    minOrderQuantity: 12,
    salesVolume: 520,
    supplierIndex: 0
  },
  {
    title: "360° Swivel Folding Camping Chair 3-Legged Portable Stool for Hiking Fishing",
    priceRange: "$5.50",
    minOrderQuantity: 20,
    salesVolume: 1200,
    supplierIndex: 1
  },
  {
    title: "Lightweight Outdoor Beach Oxford Chair for Picnic & Travel",
    priceRange: "$2.29 - $2.86",
    minOrderQuantity: 6,
    salesVolume: 350,
    supplierIndex: 2
  },
  {
    title: "Outdoor Folding High-Back Camping Chair Portable Armchair with Cup Holder",
    priceRange: "$3.20",
    minOrderQuantity: 50,
    salesVolume: 800,
    supplierIndex: 3
  },
  {
    title: "Wholesale Lightweight Portable Outdoor Hiking Picnic Chair",
    priceRange: "$3.20 - $4.00",
    minOrderQuantity: 50,
    salesVolume: 2400,
    supplierIndex: 4
  },
  {
    title: "Outdoor Folding Arc Moon Chair Portable Lightweight Oxford Cloth Bench",
    priceRange: "$1.81 - $2.94",
    minOrderQuantity: 1,
    salesVolume: 150,
    supplierIndex: 5
  },
  {
    title: "Portable Folding Tripod Chair Ultralight Stool with Carry Bag",
    priceRange: "$1.50 - $2.10",
    minOrderQuantity: 100,
    salesVolume: 3100,
    supplierIndex: 6
  },
  {
    title: "Heavy Duty Camping Quad Chair with Cool Bag & Side Table",
    priceRange: "$8.50 - $9.90",
    minOrderQuantity: 10,
    salesVolume: 450,
    supplierIndex: 7
  },
  {
    title: "Reclining Outdoor Camp Chair with Adjustable Footrest & Headrest",
    priceRange: "$12.40 - $14.50",
    minOrderQuantity: 5,
    salesVolume: 670,
    supplierIndex: 8
  },
  {
    title: "Compact Backpacking Chair High Back Foldable Camping Stool",
    priceRange: "$6.80 - $7.50",
    minOrderQuantity: 30,
    salesVolume: 180,
    supplierIndex: 9
  },
  {
    title: "Kids Miniature Folding Camp Chair with Safety Lock Mechanisms",
    priceRange: "$2.99 - $3.50",
    minOrderQuantity: 50,
    salesVolume: 900,
    supplierIndex: 10
  },
  {
    title: "Directors Folding Chair with Side Table & Accessory Pockets",
    priceRange: "$11.20 - $13.80",
    minOrderQuantity: 10,
    salesVolume: 740,
    supplierIndex: 11
  }
];

async function main() {
  console.log("Cleaning database...");
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.supplier.deleteMany({});

  console.log("Seeding suppliers...");
  const createdSuppliers = [];
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.create({
      data: s
    });
    createdSuppliers.push(supplier);
  }

  console.log("Seeding products...");
  const createdProducts = [];
  for (const p of productsData) {
    const supplier = createdSuppliers[p.supplierIndex];
    const product = await prisma.product.create({
      data: {
        title: p.title,
        priceRange: p.priceRange,
        minOrderQuantity: p.minOrderQuantity,
        salesVolume: p.salesVolume,
        supplierId: supplier.id
      }
    });
    createdProducts.push(product);
  }

  console.log("Seeding mock users...");
  const userKamal = await prisma.user.create({
    data: {
      id: "e17d0577-c93d-4c3e-9080-60b6bbfdf071",
      name: "Kamal Silva",
      email: "kamal@example.com"
    }
  });

  const userNimal = await prisma.user.create({
    data: {
      id: "b91d2a14-e58f-4ad1-97b0-cce218fd7d32",
      name: "Nimal Perera",
      email: "nimal@example.com"
    }
  });

  console.log("Seeding mock orders...");
  
  // Order 1 for Kamal: Lava Stone Vase Only (ordered 8 days ago)
  const date8DaysAgo = new Date();
  date8DaysAgo.setDate(date8DaysAgo.getDate() - 8);

  const orderKamal1 = await prisma.order.create({
    data: {
      userId: userKamal.id,
      status: "completed",
      totalLKR: 1100,
      createdAt: date8DaysAgo,
      items: {
        create: {
          productId: "EF_PC_HOME0V2762POD00077",
          productName: "Lava Stone Vase Only",
          quantity: 1,
          priceLKR: 1100,
          imageUrl: "https://static2.kapruka.com/product-image/width=330,quality=93,f=auto/https://partnercentral.kapruka.com/kapruka-pc/assets/images/product/pc01234/home0v2762p00077/home0v2762p00077_1.jpg"
        }
      }
    }
  });

  // Order 2 for Kamal: Folding Moon Chair (ordered 20 days ago)
  const date20DaysAgo = new Date();
  date20DaysAgo.setDate(date20DaysAgo.getDate() - 20);

  await prisma.order.create({
    data: {
      userId: userKamal.id,
      status: "completed",
      totalLKR: 7200,
      createdAt: date20DaysAgo,
      items: {
        create: {
          productId: createdProducts[0].id,
          productName: createdProducts[0].title,
          quantity: 2,
          priceLKR: 3600,
          imageUrl: "https://static2.kapruka.com/product-image/width=330,quality=93,f=auto/shops/flowershop/flowerImages/zooms/1777456272221_dsc03354.jpg" // placeholder style image
        }
      }
    }
  });

  // Order 1 for Nimal: Heavy Duty Camping Quad Chair (ordered 15 days ago)
  const date15DaysAgo = new Date();
  date15DaysAgo.setDate(date15DaysAgo.getDate() - 15);

  await prisma.order.create({
    data: {
      userId: userNimal.id,
      status: "completed",
      totalLKR: 8500,
      createdAt: date15DaysAgo,
      items: {
        create: {
          productId: createdProducts[7].id,
          productName: createdProducts[7].title,
          quantity: 1,
          priceLKR: 8500
        }
      }
    }
  });

  console.log("Database seeded successfully!");
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
