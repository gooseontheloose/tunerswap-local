// FILE: prisma/seed.ts
// PURPOSE: Seed script for TunerSwap MarketplaceDB
// STATUS: Production-ready (SQLite compatible)
//
// Run with: npx ts-node prisma/seed.ts

import { PrismaClient } from '.prisma/marketplace-client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// =============================================================================
// SEED DATA
// =============================================================================

const COLLECTIONS = [
  { name: 'Tunes', slug: 'tunes', description: 'Digital tune files for vehicle ECU programming' },
  { name: 'Parts', slug: 'parts', description: 'Physical automotive parts and accessories' },
  { name: 'Services', slug: 'services', description: 'In-person tuning and automotive services' },
];

const FACETS = [
  {
    name: 'Make',
    code: 'make',
    values: [
      { name: 'GM', code: 'gm' },
      { name: 'Ford', code: 'ford' },
      { name: 'Dodge/Ram', code: 'dodge-ram' },
      { name: 'Toyota', code: 'toyota' },
      { name: 'Honda', code: 'honda' },
      { name: 'BMW', code: 'bmw' },
      { name: 'Audi', code: 'audi' },
      { name: 'Volkswagen', code: 'volkswagen' },
      { name: 'Mercedes', code: 'mercedes' },
      { name: 'Subaru', code: 'subaru' },
      { name: 'Nissan', code: 'nissan' },
      { name: 'Mazda', code: 'mazda' },
    ],
  },
  {
    name: 'Tune Type',
    code: 'tune-type',
    values: [
      { name: 'Performance', code: 'performance' },
      { name: 'Economy', code: 'economy' },
      { name: 'Tow/Haul', code: 'tow-haul' },
      { name: 'Stage 1', code: 'stage-1' },
      { name: 'Stage 2', code: 'stage-2' },
      { name: 'Stage 3', code: 'stage-3' },
      { name: 'Custom', code: 'custom' },
    ],
  },
  {
    name: 'Software Platform',
    code: 'software-platform',
    values: [
      { name: 'HP Tuners', code: 'hp-tuners' },
      { name: 'EFI Live', code: 'efi-live' },
      { name: 'SCT', code: 'sct' },
      { name: 'Cobb', code: 'cobb' },
      { name: 'VCDS', code: 'vcds' },
      { name: 'EcuTek', code: 'ecutek' },
      { name: 'Other', code: 'other' },
    ],
  },
  {
    name: 'ECU Type',
    code: 'ecu-type',
    values: [
      { name: 'E38', code: 'e38' },
      { name: 'E67', code: 'e67' },
      { name: 'E78', code: 'e78' },
      { name: 'E92', code: 'e92' },
      { name: 'MED17', code: 'med17' },
      { name: 'Bosch ME7', code: 'bosch-me7' },
      { name: 'Cummins CM2350', code: 'cm2350' },
    ],
  },
];

const TEST_SELLERS = [
  {
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike@tunerswap.test',
    businessName: 'MJ Performance Tunes',
    location: 'Austin, TX',
    bio: 'Professional tuner with 10+ years experience specializing in GM trucks and SUVs.',
    experience: '10+',
    software: JSON.stringify(['HP Tuners', 'EFI Live']),
    vehiclePlatforms: JSON.stringify(['GM']),
    tuneTypes: JSON.stringify(['Performance', 'Tow/Haul', 'Economy']),
    hasDyno: true,
    status: 'APPROVED',
    verified: true,
  },
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah@tunerswap.test',
    businessName: 'SC Motorsports',
    location: 'Los Angeles, CA',
    bio: 'Specializing in European performance vehicles. BMW, Audi, and VW expert.',
    experience: '5-10',
    software: JSON.stringify(['VCDS', 'EcuTek']),
    vehiclePlatforms: JSON.stringify(['BMW', 'Audi', 'Volkswagen']),
    tuneTypes: JSON.stringify(['Performance', 'Stage 1', 'Stage 2']),
    hasDyno: true,
    status: 'APPROVED',
    verified: true,
  },
  {
    firstName: 'Carlos',
    lastName: 'Rivera',
    email: 'carlos@tunerswap.test',
    businessName: 'CR Diesel Performance',
    location: 'Houston, TX',
    bio: 'Diesel specialist. Duramax, Cummins, and Powerstroke tuning.',
    experience: '5-10',
    software: JSON.stringify(['EFI Live', 'HP Tuners']),
    vehiclePlatforms: JSON.stringify(['GM', 'Dodge/Ram', 'Ford']),
    tuneTypes: JSON.stringify(['Performance', 'Tow/Haul', 'Economy']),
    hasDyno: false,
    status: 'APPROVED',
    verified: false,
  },
  {
    firstName: 'James',
    lastName: 'Tanaka',
    email: 'james@tunerswap.test',
    businessName: 'JDM Tuning Co',
    location: 'San Francisco, CA',
    bio: 'JDM specialist. Honda, Subaru, Nissan, and Toyota performance tuning.',
    experience: '3-5',
    software: JSON.stringify(['Cobb', 'EcuTek']),
    vehiclePlatforms: JSON.stringify(['Honda', 'Subaru', 'Nissan', 'Toyota']),
    tuneTypes: JSON.stringify(['Performance', 'Stage 1', 'Stage 2', 'Stage 3']),
    hasDyno: true,
    status: 'APPROVED',
    verified: true,
  },
  {
    firstName: 'Marcus',
    lastName: 'Williams',
    email: 'marcus@tunerswap.test',
    businessName: 'MW Ford Performance',
    location: 'Detroit, MI',
    bio: 'Ford specialist. Mustang, F-150, and Raptor tuning expert.',
    experience: '5-10',
    software: JSON.stringify(['SCT', 'HP Tuners']),
    vehiclePlatforms: JSON.stringify(['Ford']),
    tuneTypes: JSON.stringify(['Performance', 'Tow/Haul', 'Custom']),
    hasDyno: true,
    status: 'PENDING',
    verified: false,
  },
];

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedCollections() {
  console.log('Seeding collections...');

  for (const collection of COLLECTIONS) {
    await prisma.collection.upsert({
      where: { slug: collection.slug },
      update: {},
      create: collection,
    });
  }

  console.log(`  Created/updated ${COLLECTIONS.length} collections`);
}

async function seedFacets() {
  console.log('Seeding facets...');

  for (const facet of FACETS) {
    const createdFacet = await prisma.facet.upsert({
      where: { code: facet.code },
      update: { name: facet.name },
      create: { name: facet.name, code: facet.code },
    });

    for (const value of facet.values) {
      await prisma.facetValue.upsert({
        where: {
          facetId_code: { facetId: createdFacet.id, code: value.code },
        },
        update: { name: value.name },
        create: {
          facetId: createdFacet.id,
          name: value.name,
          code: value.code,
        },
      });
    }
  }

  console.log(`  Created/updated ${FACETS.length} facets with values`);
}

async function seedTestSellers() {
  console.log('Seeding test sellers...');

  // Default password for test accounts: test123
  const passwordHash = await bcrypt.hash('test123', 12);

  for (const seller of TEST_SELLERS) {
    const slug = `${seller.firstName}-${seller.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    await prisma.seller.upsert({
      where: { email: seller.email },
      update: {
        firstName: seller.firstName,
        lastName: seller.lastName,
        businessName: seller.businessName,
        location: seller.location,
        bio: seller.bio,
        experience: seller.experience,
        software: seller.software,
        vehiclePlatforms: seller.vehiclePlatforms,
        tuneTypes: seller.tuneTypes,
        hasDyno: seller.hasDyno,
        status: seller.status,
        verified: seller.verified,
      },
      create: {
        slug,
        email: seller.email,
        passwordHash,
        firstName: seller.firstName,
        lastName: seller.lastName,
        businessName: seller.businessName,
        location: seller.location,
        bio: seller.bio,
        experience: seller.experience,
        software: seller.software,
        vehiclePlatforms: seller.vehiclePlatforms,
        tuneTypes: seller.tuneTypes,
        hasDyno: seller.hasDyno,
        status: seller.status,
        verified: seller.verified,
        verifiedAt: seller.verified ? new Date() : null,
        // Sample stats
        rating: seller.verified ? 4.5 + Math.random() * 0.5 : 0,
        reviewCount: seller.verified ? Math.floor(Math.random() * 50) + 10 : 0,
        tunesSold: seller.verified ? Math.floor(Math.random() * 200) + 50 : 0,
        totalOrders: seller.verified ? Math.floor(Math.random() * 300) + 100 : 0,
        totalRevenue: seller.verified ? Math.floor(Math.random() * 50000) + 10000 : 0,
      },
    });
  }

  console.log(`  Created/updated ${TEST_SELLERS.length} test sellers`);
  console.log('  Default password for all test sellers: test123');
}

async function seedTestProducts() {
  console.log('Seeding test products...');

  // Get Mike Johnson's seller ID
  const mike = await prisma.seller.findUnique({
    where: { email: 'mike@tunerswap.test' },
  });

  if (!mike) {
    console.log('  Skipping products - no test seller found');
    return;
  }

  // Get tune collection
  const tunesCollection = await prisma.collection.findUnique({
    where: { slug: 'tunes' },
  });

  // Get facet values
  const gmFacetValue = await prisma.facetValue.findFirst({
    where: { code: 'gm' },
  });
  const performanceFacetValue = await prisma.facetValue.findFirst({
    where: { code: 'performance' },
  });
  const hpTunersFacetValue = await prisma.facetValue.findFirst({
    where: { code: 'hp-tuners' },
  });

  const testProducts = [
    {
      sku: 'MJ-GM-PERF-001',
      slug: 'silverado-performance-tune',
      name: 'Silverado 5.3L Performance Tune',
      description: 'Stage 1 performance tune for 2014-2018 Silverado 5.3L V8. Adds 30+ HP and improved throttle response.',
      price: 299.99,
      productType: 'TUNE',
      isDigital: true,
      status: 'ACTIVE',
      publishedAt: new Date(),
    },
    {
      sku: 'MJ-GM-TOW-001',
      slug: 'silverado-tow-tune',
      name: 'Silverado 6.2L Tow/Haul Tune',
      description: 'Optimized tune for towing with your 2019+ Silverado 6.2L. Better transmission behavior and power delivery.',
      price: 349.99,
      productType: 'TUNE',
      isDigital: true,
      status: 'ACTIVE',
      publishedAt: new Date(),
    },
    {
      sku: 'MJ-GM-ECON-001',
      slug: 'tahoe-economy-tune',
      name: 'Tahoe 5.3L Economy Tune',
      description: 'Fuel economy focused tune for 2015-2020 Tahoe 5.3L. Gain 2-3 MPG with smoother shifts.',
      price: 249.99,
      productType: 'TUNE',
      isDigital: true,
      status: 'DRAFT',
    },
  ];

  for (const product of testProducts) {
    const existingProduct = await prisma.product.findFirst({
      where: { vendorId: mike.id, sku: product.sku },
    });

    if (existingProduct) {
      console.log(`  Product ${product.sku} already exists, skipping`);
      continue;
    }

    const created = await prisma.product.create({
      data: {
        vendorId: mike.id,
        ...product,
      },
    });

    // Add to tunes collection
    if (tunesCollection) {
      await prisma.productCollection.create({
        data: {
          productId: created.id,
          collectionId: tunesCollection.id,
        },
      });
    }

    // Add facet values
    const facetValueIds = [gmFacetValue?.id, performanceFacetValue?.id, hpTunersFacetValue?.id].filter(Boolean) as number[];
    for (const facetValueId of facetValueIds) {
      await prisma.productFacetValue.create({
        data: {
          productId: created.id,
          facetValueId,
        },
      });
    }

    // Add compatibility
    await prisma.productCompatibility.create({
      data: {
        productId: created.id,
        make: 'Chevrolet',
        model: 'Silverado',
        yearStart: 2014,
        yearEnd: 2018,
        engine: '5.3L V8',
      },
    });

    console.log(`  Created product: ${product.name}`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n========================================');
  console.log('TunerSwap MarketplaceDB Seed');
  console.log('========================================\n');

  try {
    await seedCollections();
    await seedFacets();
    await seedTestSellers();
    await seedTestProducts();

    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log('========================================\n');
    console.log('Test accounts:');
    console.log('  Email: mike@tunerswap.test');
    console.log('  Password: test123');
    console.log('');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
