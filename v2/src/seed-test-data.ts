/**
 * TunerSwap Test Data Seed Script
 *
 * Creates 10 test sellers via the shop API registerSeller mutation.
 * Each seller will have products created via admin API after logging in.
 *
 * Run with: npm run seed (while server is running)
 */

const SHOP_API = 'http://localhost:3000/shop-api';
const ADMIN_API = 'http://localhost:3000/admin-api';

// Test seller data
const testSellers = [
    {
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike@tunerswap.test',
        password: 'test1234',
        businessName: 'Mike Johnson Performance',
        location: 'Houston, TX',
        bio: 'V8 performance specialist with 15 years of experience. Specializing in GM LS/LT engines and Ford Coyote platforms.',
        experience: '10+',
        software: ['HP Tuners', 'EFI Live', 'SCT'],
        vehiclePlatforms: ['GM', 'Ford', 'Mopar'],
        tuneTypes: ['Performance', 'Economy', 'Tow/Haul'],
        hasDyno: 'yes',
    },
    {
        firstName: 'Sarah',
        lastName: 'Chen',
        email: 'sarah@tunerswap.test',
        password: 'test1234',
        businessName: 'Euro Tuning Specialists',
        location: 'Los Angeles, CA',
        bio: 'European vehicle tuning expert. BMW, Audi, Mercedes, and VW specialist with factory-level diagnostics.',
        experience: '5-10',
        software: ['VCDS', 'ISTA', 'Cobb Accessport'],
        vehiclePlatforms: ['BMW', 'Audi', 'VW', 'Mercedes'],
        tuneTypes: ['Performance', 'Stage 1', 'Stage 2'],
        hasDyno: 'yes',
    },
    {
        firstName: 'Carlos',
        lastName: 'Rivera',
        email: 'carlos@tunerswap.test',
        password: 'test1234',
        businessName: 'Rivera Diesel Performance',
        location: 'Dallas, TX',
        bio: 'Diesel tuning specialist for trucks and heavy equipment. DPF deletes, EGR solutions, and power upgrades.',
        experience: '10+',
        software: ['EFI Live', 'HP Tuners', 'MM3'],
        vehiclePlatforms: ['Cummins', 'Duramax', 'Powerstroke'],
        tuneTypes: ['Diesel Performance', 'Tow/Haul', 'Economy'],
        hasDyno: 'yes',
    },
    {
        firstName: 'James',
        lastName: 'Tanaka',
        email: 'james@tunerswap.test',
        password: 'test1234',
        businessName: 'JDM Masters',
        location: 'San Diego, CA',
        bio: 'Japanese import specialist. Honda, Toyota, Nissan, and Subaru tuning with extensive track experience.',
        experience: '5-10',
        software: ['Hondata', 'Ecutek', 'Cobb Accessport'],
        vehiclePlatforms: ['Honda', 'Toyota', 'Nissan', 'Subaru'],
        tuneTypes: ['Performance', 'Track', 'Daily Driver'],
        hasDyno: 'yes',
    },
    {
        firstName: 'Marcus',
        lastName: 'Williams',
        email: 'marcus@tunerswap.test',
        password: 'test1234',
        businessName: 'Boost Factory',
        location: 'Phoenix, AZ',
        bio: 'Forced induction expert. Turbo and supercharger tuning for all platforms. Custom boost solutions.',
        experience: '5-10',
        software: ['HP Tuners', 'AEM', 'Haltech'],
        vehiclePlatforms: ['Universal', 'Ford', 'GM', 'Import'],
        tuneTypes: ['Turbo', 'Supercharger', 'E85'],
        hasDyno: 'yes',
    },
    {
        firstName: 'David',
        lastName: 'Miller',
        email: 'david@tunerswap.test',
        password: 'test1234',
        businessName: 'EcoBoost Elite',
        location: 'Detroit, MI',
        bio: 'Ford EcoBoost specialist. F-150, Mustang, and Focus ST/RS tuning. OEM+ quality calibrations.',
        experience: '3-5',
        software: ['SCT', 'HP Tuners', 'Cobb Accessport'],
        vehiclePlatforms: ['Ford', 'EcoBoost'],
        tuneTypes: ['Performance', 'Economy', 'E85'],
        hasDyno: 'no',
    },
    {
        firstName: 'Ryan',
        lastName: 'Thompson',
        email: 'ryan@tunerswap.test',
        password: 'test1234',
        businessName: 'LS Swaps & More',
        location: 'Atlanta, GA',
        bio: 'LS engine specialist. Swap tuning, standalone harness solutions, and complete engine management.',
        experience: '5-10',
        software: ['HP Tuners', 'Holley EFI', 'MegaSquirt'],
        vehiclePlatforms: ['GM', 'LS Swap', 'Corvette', 'Camaro'],
        tuneTypes: ['Swap', 'Performance', 'Standalone'],
        hasDyno: 'yes',
    },
    {
        firstName: 'Kevin',
        lastName: 'Brown',
        email: 'kevin@tunerswap.test',
        password: 'test1234',
        businessName: 'Mustang Maniacs',
        location: 'Nashville, TN',
        bio: 'Ford Mustang specialist. S197 and S550 Coyote tuning. Drag, street, and track calibrations.',
        experience: '3-5',
        software: ['SCT', 'HP Tuners', 'Lund Racing'],
        vehiclePlatforms: ['Ford', 'Mustang', 'Coyote'],
        tuneTypes: ['Performance', 'Drag', 'Street'],
        hasDyno: 'yes',
    },
    {
        firstName: 'Anthony',
        lastName: 'Garcia',
        email: 'anthony@tunerswap.test',
        password: 'test1234',
        businessName: 'Hemi Power House',
        location: 'Charlotte, NC',
        bio: 'Mopar HEMI specialist. Challenger, Charger, and RAM tuning. Supercharger and NA builds.',
        experience: '5-10',
        software: ['HP Tuners', 'Diablosport', 'Tazer'],
        vehiclePlatforms: ['Dodge', 'Chrysler', 'Jeep', 'RAM'],
        tuneTypes: ['Performance', 'Hellcat', 'NA'],
        hasDyno: 'yes',
    },
    {
        firstName: 'Brandon',
        lastName: 'Lee',
        email: 'brandon@tunerswap.test',
        password: 'test1234',
        businessName: 'Korean Performance Labs',
        location: 'Seattle, WA',
        bio: 'Hyundai and Kia performance specialist. N-Line and Stinger tuning. Emerging platform expert.',
        experience: '1-3',
        software: ['Sxth Element', 'JB4', 'Lap3'],
        vehiclePlatforms: ['Hyundai', 'Kia', 'Genesis'],
        tuneTypes: ['Performance', 'Stage 1', 'E85'],
        hasDyno: 'no',
    },
];

// Product templates
const tuneTemplates = [
    { name: 'Stage 1 Performance Tune', price: 39999, desc: 'Bolt-on friendly tune for maximum power with stock components. Safe daily driver calibration.' },
    { name: 'Stage 2 Performance Tune', price: 59999, desc: 'Full bolt-on tune for exhaust, intake, and supporting mods. Aggressive power delivery.' },
    { name: 'E85 Flex Fuel Tune', price: 69999, desc: 'Ethanol-optimized tune with automatic blend detection. Maximum power on E85 fuel.' },
    { name: 'Economy/MPG Tune', price: 29999, desc: 'Fuel economy focused calibration. Better MPG without sacrificing drivability.' },
    { name: 'Custom Dyno Tune', price: 149999, desc: 'Full custom dyno calibration tailored to your exact modifications and goals.' },
];

const partTemplates = [
    { name: 'Cold Air Intake System', price: 34999, desc: 'High-flow cold air intake with washable filter. Adds 10-15hp and better throttle response.' },
    { name: 'Performance Exhaust System', price: 124999, desc: 'Cat-back exhaust system with mandrel-bent tubing. Aggressive sound and improved flow.' },
    { name: 'Intercooler Upgrade Kit', price: 89999, desc: 'Front-mount intercooler kit for forced induction applications. Lower IATs and consistent power.' },
    { name: 'Performance Downpipe', price: 44999, desc: 'High-flow downpipe for turbo applications. Reduces backpressure and adds power.' },
    { name: 'Catch Can Kit', price: 19999, desc: 'Oil catch can system to prevent carbon buildup. Essential for direct injection engines.' },
];

const serviceTemplates = [
    { name: 'Dyno Tuning Session (2hr)', price: 29999, desc: 'Two-hour dyno session with professional calibration. Includes before/after dyno pulls.' },
    { name: 'Full Day Dyno Session', price: 59999, desc: 'Full day dyno session for complex builds. Includes data logging and optimization.' },
    { name: 'ECU Flash Service', price: 14999, desc: 'In-person ECU flashing service. Quick turnaround with professional installation.' },
    { name: 'Diagnostic & Consultation', price: 9999, desc: 'Professional diagnostic scan and tuning consultation. Identify issues and plan upgrades.' },
    { name: 'Track Day Support', price: 79999, desc: 'On-site track day tuning support. Real-time adjustments and data analysis.' },
];

async function graphqlRequest(url: string, query: string, variables: any = {}, authToken?: string) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error');
    }
    return result.data;
}

async function loginAdmin(): Promise<string> {
    const query = `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser {
                    id
                }
                ... on InvalidCredentialsError {
                    message
                }
            }
        }
    `;

    // First try to login, if it fails we need to create the superadmin
    try {
        const result = await graphqlRequest(ADMIN_API, query, {
            username: 'superadmin',
            password: 'superadmin',
        });
        console.log('Logged in as superadmin');
        return 'superadmin'; // For now, just return a placeholder - we'll use cookies
    } catch (error) {
        console.log('Superadmin login failed, may need to be created first');
        throw error;
    }
}

async function createSellerViaAdminAPI(seller: typeof testSellers[0]) {
    // Step 1: Create Vendure Seller entity
    const createSellerQuery = `
        mutation CreateSeller($input: CreateSellerInput!) {
            createSeller(input: $input) {
                id
                name
            }
        }
    `;

    const sellerResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createSellerQuery,
            variables: {
                input: {
                    name: seller.businessName,
                },
            },
        }),
    });

    const sellerResult = await sellerResponse.json();
    if (sellerResult.errors) {
        throw new Error(sellerResult.errors[0]?.message || 'Failed to create seller');
    }
    const vendureSeller = sellerResult.data.createSeller;

    // Step 2: Get default channel and zones
    const channelsQuery = `
        query {
            channels {
                items {
                    id
                    code
                    defaultLanguageCode
                    defaultCurrencyCode
                    pricesIncludeTax
                    defaultShippingZone { id }
                    defaultTaxZone { id }
                }
            }
            zones {
                items {
                    id
                    name
                }
            }
        }
    `;

    const channelsResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({ query: channelsQuery }),
    });
    const channelsResult = await channelsResponse.json();
    const defaultChannel = channelsResult.data.channels.items.find((c: any) => c.code === '__default_channel__') || channelsResult.data.channels.items[0];

    // Get or create a zone
    let zoneId = defaultChannel.defaultShippingZone?.id || defaultChannel.defaultTaxZone?.id;

    if (!zoneId && channelsResult.data.zones?.items?.length > 0) {
        zoneId = channelsResult.data.zones.items[0].id;
    }

    // If still no zone, create one
    if (!zoneId) {
        const createZoneQuery = `
            mutation CreateZone($input: CreateZoneInput!) {
                createZone(input: $input) {
                    id
                    name
                }
            }
        `;

        const zoneResponse = await authenticatedFetch(ADMIN_API, {
            method: 'POST',
            body: JSON.stringify({
                query: createZoneQuery,
                variables: {
                    input: {
                        name: 'Default Zone',
                    },
                },
            }),
        });
        const zoneResult = await zoneResponse.json();
        if (zoneResult.errors) {
            throw new Error('Could not create zone: ' + zoneResult.errors[0]?.message);
        }
        zoneId = zoneResult.data.createZone.id;
    }

    // Step 3: Create a Channel for the seller
    const channelCode = seller.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 20) + '-' + Math.random().toString(36).substring(2, 6);
    const channelToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    const createChannelQuery = `
        mutation CreateChannel($input: CreateChannelInput!) {
            createChannel(input: $input) {
                ... on Channel {
                    id
                    code
                }
                ... on LanguageNotAvailableError {
                    message
                }
            }
        }
    `;

    const channelResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createChannelQuery,
            variables: {
                input: {
                    code: channelCode,
                    token: channelToken,
                    defaultLanguageCode: defaultChannel.defaultLanguageCode || 'en',
                    defaultCurrencyCode: defaultChannel.defaultCurrencyCode || 'USD',
                    pricesIncludeTax: defaultChannel.pricesIncludeTax || false,
                    defaultShippingZoneId: zoneId,
                    defaultTaxZoneId: zoneId,
                    sellerId: vendureSeller.id,
                },
            },
        }),
    });

    const channelResult = await channelResponse.json();
    if (channelResult.errors || channelResult.data.createChannel?.message) {
        throw new Error(channelResult.errors?.[0]?.message || channelResult.data.createChannel?.message || 'Failed to create channel');
    }
    const sellerChannel = channelResult.data.createChannel;

    // Step 4: Create a Role for the seller
    const createRoleQuery = `
        mutation CreateRole($input: CreateRoleInput!) {
            createRole(input: $input) {
                id
                code
            }
        }
    `;

    const roleResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createRoleQuery,
            variables: {
                input: {
                    code: `seller-${channelCode}`,
                    description: `Role for seller: ${seller.businessName}`,
                    permissions: [
                        'CreateCatalog', 'ReadCatalog', 'UpdateCatalog', 'DeleteCatalog',
                        'CreateProduct', 'ReadProduct', 'UpdateProduct', 'DeleteProduct',
                        'CreateAsset', 'ReadAsset', 'UpdateAsset', 'DeleteAsset',
                        'ReadOrder', 'UpdateOrder',
                        'ReadCustomer',
                        'CreateCollection', 'ReadCollection', 'UpdateCollection',
                        'ReadShippingMethod', 'UpdateShippingMethod',
                        'ReadStockLocation', 'UpdateStockLocation',
                        'ReadFacet', 'CreateFacet', 'UpdateFacet',
                        'ReadPromotion', 'CreatePromotion', 'UpdatePromotion', 'DeletePromotion',
                        'ReadSettings', 'UpdateSettings',
                    ],
                    channelIds: [sellerChannel.id],
                },
            },
        }),
    });

    const roleResult = await roleResponse.json();
    if (roleResult.errors) {
        throw new Error(roleResult.errors[0]?.message || 'Failed to create role');
    }
    const sellerRole = roleResult.data.createRole;

    // Step 5: Create an Administrator for the seller
    const createAdminQuery = `
        mutation CreateAdministrator($input: CreateAdministratorInput!) {
            createAdministrator(input: $input) {
                id
                emailAddress
            }
        }
    `;

    const adminResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createAdminQuery,
            variables: {
                input: {
                    firstName: seller.firstName,
                    lastName: seller.lastName,
                    emailAddress: seller.email,
                    password: seller.password,
                    roleIds: [sellerRole.id],
                },
            },
        }),
    });

    const adminResult = await adminResponse.json();
    if (adminResult.errors) {
        throw new Error(adminResult.errors[0]?.message || 'Failed to create administrator');
    }

    // Step 6: Create SellerProfile entity so products can be associated
    const createSellerProfileQuery = `
        mutation CreateSellerProfile($input: CreateSellerProfileInput!) {
            createSellerProfile(input: $input) {
                id
                slug
            }
        }
    `;

    const sellerProfileResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createSellerProfileQuery,
            variables: {
                input: {
                    firstName: seller.firstName,
                    lastName: seller.lastName,
                    businessName: seller.businessName,
                    bio: seller.bio,
                    location: seller.location,
                    phone: '(555) 123-4567',
                    website: '',
                    experience: seller.experience,
                    software: seller.software,
                    vehiclePlatforms: seller.vehiclePlatforms,
                    tuneTypes: seller.tuneTypes,
                    hasDyno: seller.hasDyno,
                    status: 'approved',
                    verified: true,
                },
            },
        }),
    });

    const sellerProfileResult = await sellerProfileResponse.json();
    let sellerProfileId = vendureSeller.id; // Fallback to Vendure seller ID if profile creation fails

    if (sellerProfileResult.data?.createSellerProfile?.id) {
        sellerProfileId = sellerProfileResult.data.createSellerProfile.id;
        console.log(`    Created SellerProfile: ${sellerProfileId}`);
    } else if (sellerProfileResult.errors) {
        console.log(`    Warning: Could not create SellerProfile: ${sellerProfileResult.errors[0]?.message}`);
    }

    return { success: true, sellerId: sellerProfileId, channelId: sellerChannel.id };
}

async function createProductViaAdmin(
    productData: {
        name: string;
        slug: string;
        description: string;
        price: number;
        productType: string;
        isDigital: boolean;
        sellerId?: string;
        platform?: string;
        software?: string;
        hpGain?: string;
        torqueGain?: string;
    },
    channelId?: string
) {
    // Create product
    const createProductQuery = `
        mutation CreateProduct($input: CreateProductInput!) {
            createProduct(input: $input) {
                id
                name
                slug
            }
        }
    `;

    // Build custom fields
    const customFields: Record<string, any> = {
        productType: productData.productType,
        isDigital: productData.isDigital,
    };

    if (productData.sellerId) {
        customFields.sellerId = productData.sellerId;
    }
    if (productData.platform) {
        customFields.platform = productData.platform;
    }
    if (productData.software) {
        customFields.software = productData.software;
    }
    if (productData.hpGain) {
        customFields.hpGain = productData.hpGain;
    }
    if (productData.torqueGain) {
        customFields.torqueGain = productData.torqueGain;
    }

    const response = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createProductQuery,
            variables: {
                input: {
                    translations: [{
                        languageCode: 'en',
                        name: productData.name,
                        slug: productData.slug,
                        description: productData.description,
                    }],
                    customFields,
                },
            },
        }),
    });

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0]?.message);
    }

    const product = result.data.createProduct;

    // Assign product to seller's channel if channelId provided
    if (channelId) {
        const assignToChannelQuery = `
            mutation AssignProductsToChannel($input: AssignProductsToChannelInput!) {
                assignProductsToChannel(input: $input) {
                    id
                }
            }
        `;

        await authenticatedFetch(ADMIN_API, {
            method: 'POST',
            body: JSON.stringify({
                query: assignToChannelQuery,
                variables: {
                    input: {
                        productIds: [product.id],
                        channelId: channelId,
                        priceFactor: 1,
                    },
                },
            }),
        });
    }

    // Create variant
    const createVariantQuery = `
        mutation CreateProductVariants($productId: ID!, $input: [CreateProductVariantInput!]!) {
            createProductVariants(productId: $productId, input: $input) {
                id
                name
                price
            }
        }
    `;

    const variantResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: createVariantQuery,
            variables: {
                productId: product.id,
                input: [{
                    sku: productData.slug.toUpperCase().replace(/-/g, '').slice(0, 20) + Math.random().toString(36).substring(2, 6),
                    price: productData.price,
                    translations: [{
                        languageCode: 'en',
                        name: productData.name,
                    }],
                    trackInventory: productData.isDigital ? 'FALSE' : 'INHERIT',
                    stockOnHand: productData.isDigital ? 0 : Math.floor(5 + Math.random() * 20),
                }],
            },
        }),
    });

    const variantResult = await variantResponse.json();
    if (variantResult.errors) {
        console.error(`Failed to create variant for ${productData.name}:`, variantResult.errors[0]?.message);
    }

    return product;
}

// Global cookie jar for maintaining session
let sessionCookie = '';

async function authenticatedFetch(url: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // Capture any set-cookie headers
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        // Extract the session cookie
        const sessionMatch = setCookie.match(/session(?:\.sig)?=[^;]+/g);
        if (sessionMatch) {
            sessionCookie = sessionMatch.join('; ');
        }
    }

    return response;
}

async function seedTestData() {
    console.log('========================================');
    console.log('TunerSwap Test Data Seeder');
    console.log('========================================\n');

    // First, login to admin to get auth cookie
    console.log('Logging into admin API...');

    const loginResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: `
                mutation {
                    login(username: "superadmin", password: "superadmin") {
                        ... on CurrentUser { id }
                        ... on InvalidCredentialsError { message }
                    }
                }
            `,
        }),
    });

    const loginResult = await loginResponse.json();

    if (loginResult.errors || loginResult.data?.login?.message) {
        console.error('Failed to login as superadmin. Make sure the server is running and superadmin exists.');
        console.log('Run the server first: npm run dev');
        process.exit(1);
    }

    if (!sessionCookie) {
        console.log('Warning: No session cookie received. Trying to continue anyway...');
    }

    console.log('✓ Logged in as superadmin\n');

    // Create sellers
    console.log('Creating test sellers...\n');
    const createdSellers: Array<{ seller: typeof testSellers[0]; sellerId: string; channelId: string }> = [];

    for (const seller of testSellers) {
        try {
            const result = await createSellerViaAdminAPI(seller);
            if (result.success) {
                console.log(`✓ Created: ${seller.businessName}`);
                createdSellers.push({ seller, sellerId: result.sellerId, channelId: result.channelId });
            }
        } catch (error: any) {
            if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
                console.log(`○ Exists: ${seller.businessName}`);
            } else {
                console.log(`✗ Error: ${seller.businessName} - ${error.message}`);
            }
        }
    }

    console.log(`\nCreated ${createdSellers.length} new sellers.\n`);

    // Create products for each seller
    console.log('Creating products...\n');

    let tunesCreated = 0;
    let partsCreated = 0;
    let servicesCreated = 0;

    for (const { seller, sellerId, channelId } of createdSellers) {
        console.log(`\n${seller.businessName} (Seller: ${sellerId}, Channel: ${channelId}):`);
        const slugPrefix = seller.businessName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Create tunes - with sellerId for association
        for (let i = 0; i < tuneTemplates.length; i++) {
            const template = tuneTemplates[i];
            const platform = seller.vehiclePlatforms[i % seller.vehiclePlatforms.length];
            const software = seller.software[i % seller.software.length];
            try {
                await createProductViaAdmin({
                    name: `${platform} ${template.name}`,
                    slug: `${slugPrefix}-${platform.toLowerCase()}-${template.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`,
                    description: template.desc,
                    price: template.price,
                    productType: 'tune',
                    isDigital: true,
                    sellerId: sellerId,
                    platform: platform,
                    software: software,
                    hpGain: `${20 + Math.floor(Math.random() * 50)}`,
                    torqueGain: `${25 + Math.floor(Math.random() * 60)}`,
                }, channelId);
                tunesCreated++;
                process.stdout.write('T');
            } catch (error: any) {
                process.stdout.write('x');
            }
        }

        // Create parts - with sellerId for association
        for (let i = 0; i < partTemplates.length; i++) {
            const template = partTemplates[i];
            const platform = seller.vehiclePlatforms[i % seller.vehiclePlatforms.length];
            try {
                await createProductViaAdmin({
                    name: `${platform} ${template.name}`,
                    slug: `${slugPrefix}-${platform.toLowerCase()}-${template.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`,
                    description: template.desc,
                    price: template.price,
                    productType: 'part',
                    isDigital: false,
                    sellerId: sellerId,
                }, channelId);
                partsCreated++;
                process.stdout.write('P');
            } catch (error: any) {
                process.stdout.write('x');
            }
        }

        // Create services - with sellerId for association
        for (let i = 0; i < serviceTemplates.length; i++) {
            const template = serviceTemplates[i];
            try {
                await createProductViaAdmin({
                    name: `${template.name} - ${seller.businessName}`,
                    slug: `${slugPrefix}-${template.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`,
                    description: `${template.desc} Located in ${seller.location}.`,
                    price: template.price,
                    productType: 'service',
                    isDigital: false,
                    sellerId: sellerId,
                }, channelId);
                servicesCreated++;
                process.stdout.write('S');
            } catch (error: any) {
                process.stdout.write('x');
            }
        }
        console.log(''); // newline
    }

    console.log('\n========================================');
    console.log('Seeding Complete!');
    console.log('========================================');
    console.log(`\nCreated:`);
    console.log(`  - ${createdSellers.length} sellers`);
    console.log(`  - ${tunesCreated} tunes`);
    console.log(`  - ${partsCreated} parts`);
    console.log(`  - ${servicesCreated} services`);
    console.log(`\nTotal products: ${tunesCreated + partsCreated + servicesCreated}`);
    console.log(`\nTest accounts (password: test1234):`);
    for (const seller of testSellers) {
        console.log(`  - ${seller.email}`);
    }
    console.log(`\nAdmin: superadmin / superadmin`);
}

// =============================================
// CUSTOMER ACCOUNTS FOR SHOP API TESTING
// =============================================

const testCustomerAccounts = [
    {
        email: 'testbuyer@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Buyer',
        isSeller: false,
        description: 'Standard buyer account for testing buyer dashboard',
    },
    {
        email: 'testseller@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Seller',
        isSeller: true,
        profileComplete: true,
        businessName: 'Test Performance Shop',
        phone: '(555) 123-4567',
        location: 'Austin, TX',
        bio: 'Test seller account with complete profile for testing seller dashboard features.',
        description: 'Seller account with complete profile',
    },
    {
        email: 'newseller@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'Seller',
        isSeller: true,
        profileComplete: false,
        description: 'Seller account with incomplete profile (triggers BusinessInfoModal)',
    },
];

async function createTestCustomerAccount(account: typeof testCustomerAccounts[0]) {
    // Register customer via shop API
    const registerMutation = `
        mutation RegisterCustomerAccount($input: RegisterCustomerInput!) {
            registerCustomerAccount(input: $input) {
                ... on Success {
                    success
                }
                ... on MissingPasswordError {
                    message
                }
                ... on NativeAuthStrategyError {
                    message
                }
            }
        }
    `;

    const response = await fetch(SHOP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: registerMutation,
            variables: {
                input: {
                    emailAddress: account.email,
                    firstName: account.firstName,
                    lastName: account.lastName,
                    password: account.password,
                },
            },
        }),
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Registration failed');
    }

    const registerResult = result.data.registerCustomerAccount;
    if (registerResult.message) {
        throw new Error(registerResult.message);
    }

    // If this is a seller account, create seller profile
    if (account.isSeller) {
        // First login to get customer context
        const loginMutation = `
            mutation Login($username: String!, $password: String!) {
                login(username: $username, password: $password) {
                    ... on CurrentUser { id }
                    ... on InvalidCredentialsError { message }
                    ... on NotVerifiedError { message }
                }
            }
        `;

        // Note: In dev, we need to verify the account first via admin API
        await verifyCustomerAccount(account.email);

        // Now login via shop API
        let shopCookie = '';
        const loginResponse = await fetch(SHOP_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: loginMutation,
                variables: {
                    username: account.email,
                    password: account.password,
                },
            }),
        });

        const setCookie = loginResponse.headers.get('set-cookie');
        if (setCookie) {
            const sessionMatch = setCookie.match(/session(?:\.sig)?=[^;]+/g);
            if (sessionMatch) {
                shopCookie = sessionMatch.join('; ');
            }
        }

        const loginResult = await loginResponse.json();
        if (loginResult.data?.login?.message) {
            throw new Error(loginResult.data.login.message);
        }

        // Create seller profile via shop API
        const createSellerMutation = `
            mutation RegisterSeller($input: RegisterSellerInput!) {
                registerSeller(input: $input) {
                    success
                    sellerId
                    message
                }
            }
        `;

        const sellerInput: any = {
            email: account.email,
            password: account.password,
            firstName: account.firstName,
            lastName: account.lastName,
        };

        if (account.profileComplete) {
            sellerInput.businessName = account.businessName;
            sellerInput.phone = account.phone;
            sellerInput.location = account.location;
            sellerInput.bio = account.bio;
        }

        const sellerResponse = await fetch(SHOP_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': shopCookie,
            },
            body: JSON.stringify({
                query: createSellerMutation,
                variables: { input: sellerInput },
            }),
        });

        const sellerResult = await sellerResponse.json();

        if (sellerResult.errors) {
            console.log(`  Warning: registerSeller for ${account.email} had errors:`, sellerResult.errors[0]?.message);
        }

        // If profile complete flag needs to be set, update it
        if (account.profileComplete && sellerResult.data?.registerSeller?.success) {
            const updateProfileMutation = `
                mutation UpdateSellerProfile($input: UpdateSellerProfileInput!) {
                    updateSellerProfile(input: $input) {
                        id
                        profileComplete
                    }
                }
            `;

            await fetch(SHOP_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': shopCookie,
                },
                body: JSON.stringify({
                    query: updateProfileMutation,
                    variables: {
                        input: {
                            profileComplete: true,
                        },
                    },
                }),
            });
        }
    }

    return { success: true };
}

async function verifyCustomerAccount(email: string) {
    // Get customer by email via admin API
    const getCustomerQuery = `
        query {
            customers(options: { filter: { emailAddress: { eq: "${email}" } } }) {
                items {
                    id
                    user {
                        id
                        verified
                    }
                }
            }
        }
    `;

    const response = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({ query: getCustomerQuery }),
    });

    const result = await response.json();
    const customer = result.data?.customers?.items?.[0];

    if (!customer) {
        console.log(`  Warning: Customer ${email} not found for verification`);
        return;
    }

    if (customer.user?.verified) {
        return; // Already verified
    }

    // Verify the user
    const verifyMutation = `
        mutation UpdateCustomer($input: UpdateCustomerInput!) {
            updateCustomer(input: $input) {
                id
                user {
                    verified
                }
            }
        }
    `;

    await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: verifyMutation,
            variables: {
                input: {
                    id: customer.id,
                    // Vendure doesn't allow direct verification this way
                    // We need to use a different approach
                },
            },
        }),
    });

    // Alternative: directly update the user's verified flag
    // This requires a custom admin mutation or direct DB access
    // For now, we'll note that verification needs to happen via email link
    console.log(`  Note: ${email} needs email verification (click link in email)`);
}

async function seedCustomerAccounts() {
    console.log('\n========================================');
    console.log('Creating Test Customer Accounts');
    console.log('========================================\n');

    for (const account of testCustomerAccounts) {
        try {
            await createTestCustomerAccount(account);
            console.log(`✓ Created: ${account.email} (${account.description})`);
        } catch (error: any) {
            if (error.message?.includes('already exists') || error.message?.includes('EMAIL_ADDRESS_CONFLICT')) {
                console.log(`○ Exists: ${account.email}`);
            } else {
                console.log(`✗ Error: ${account.email} - ${error.message}`);
            }
        }
    }

    console.log('\n----------------------------------------');
    console.log('Test Accounts Summary:');
    console.log('----------------------------------------');
    console.log('Buyer account (test buyeradmin dashboard):');
    console.log('  Email: testbuyer@test.com');
    console.log('  Password: password123');
    console.log('\nSeller with complete profile (normal selleradmin):');
    console.log('  Email: testseller@test.com');
    console.log('  Password: password123');
    console.log('\nSeller with incomplete profile (shows BusinessInfoModal):');
    console.log('  Email: newseller@test.com');
    console.log('  Password: password123');
}

seedTestData()
    .then(() => seedCustomerAccounts())
    .catch((error) => {
        console.error('\nSeeding failed:', error.message);
        process.exit(1);
    });
