/**
 * Fix script to assign existing products to their seller's channel
 * Run once after the seed to fix channel assignments
 */

const ADMIN_API = 'http://localhost:3000/admin-api';
let sessionCookie = '';

async function authenticatedFetch(url: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (sessionCookie) {
        headers['Cookie'] = sessionCookie;
    }
    const response = await fetch(url, { ...options, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        const sessionMatch = setCookie.match(/session(?:\.sig)?=[^;]+/g);
        if (sessionMatch) {
            sessionCookie = sessionMatch.join('; ');
        }
    }
    return response;
}

async function fixProductChannels() {
    console.log('Fixing product channel assignments...\n');

    // Login
    const loginResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: `mutation { login(username: "superadmin", password: "superadmin") { ... on CurrentUser { id } } }`,
        }),
    });
    await loginResponse.json();
    console.log('Logged in as superadmin');

    // Get all channels (seller channels)
    const channelsResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: `query { channels { items { id code seller { name } } } }`,
        }),
    });
    const channelsResult = await channelsResponse.json();
    const sellerChannels = channelsResult.data.channels.items.filter((c: any) =>
        c.code !== '__default_channel__' && c.seller
    );
    console.log(`Found ${sellerChannels.length} seller channels`);

    // Get all products
    const productsResponse = await authenticatedFetch(ADMIN_API, {
        method: 'POST',
        body: JSON.stringify({
            query: `query { products(options: { take: 200 }) { items { id name slug channels { id code } } } }`,
        }),
    });
    const productsResult = await productsResponse.json();
    const products = productsResult.data.products.items;
    console.log(`Found ${products.length} products to assign\n`);

    // Map product slug prefix to seller channel code prefix
    const slugToChannelPrefix: Record<string, string> = {
        'mike-johnson-performance': 'mike-johnson-perform',
        'euro-tuning-specialists': 'euro-tuning-speciali',
        'rivera-diesel-performance': 'rivera-diesel-perfor',
        'jdm-masters': 'jdm-masters',
        'boost-factory': 'boost-factory',
        'ecoboost-elite': 'ecoboost-elite',
        'ls-swaps-more': 'ls-swaps-more',
        'mustang-maniacs': 'mustang-maniacs',
        'hemi-power-house': 'hemi-power-house',
        'korean-performance-labs': 'korean-performance-l',
    };

    // Group products by seller slug prefix
    const productsByPrefix: Record<string, any[]> = {};
    for (const product of products) {
        for (const slugPrefix of Object.keys(slugToChannelPrefix)) {
            if (product.slug.startsWith(slugPrefix)) {
                if (!productsByPrefix[slugPrefix]) {
                    productsByPrefix[slugPrefix] = [];
                }
                productsByPrefix[slugPrefix].push(product);
                break;
            }
        }
    }

    // For each seller prefix, find the matching channel and assign products
    for (const [slugPrefix, channelPrefix] of Object.entries(slugToChannelPrefix)) {
        const productsForSeller = productsByPrefix[slugPrefix] || [];
        if (productsForSeller.length === 0) {
            console.log(`No products found for ${slugPrefix}`);
            continue;
        }

        // Find the matching channel(s) - we want the newest one (highest id)
        const matchingChannels = sellerChannels.filter((c: any) =>
            c.code.startsWith(channelPrefix)
        ).sort((a: any, b: any) => parseInt(b.id) - parseInt(a.id));

        if (matchingChannels.length === 0) {
            console.log(`No channel found for ${slugPrefix}`);
            continue;
        }

        const channel = matchingChannels[0]; // Use the newest channel
        const productIds = productsForSeller.map((p: any) => p.id);

        // Check if already assigned
        const alreadyAssigned = productsForSeller.filter((p: any) =>
            p.channels.some((c: any) => c.id === channel.id)
        );
        if (alreadyAssigned.length === productsForSeller.length) {
            console.log(`All ${productsForSeller.length} products already assigned to ${channel.seller?.name || channel.code}`);
            continue;
        }

        console.log(`Assigning ${productIds.length} products to ${channel.seller?.name || channel.code} (channel ${channel.id})...`);

        // Assign products to channel
        const assignResponse = await authenticatedFetch(ADMIN_API, {
            method: 'POST',
            body: JSON.stringify({
                query: `
                    mutation AssignProductsToChannel($input: AssignProductsToChannelInput!) {
                        assignProductsToChannel(input: $input) { id name }
                    }
                `,
                variables: {
                    input: {
                        productIds: productIds,
                        channelId: channel.id,
                        priceFactor: 1,
                    },
                },
            }),
        });
        const assignResult = await assignResponse.json();
        if (assignResult.errors) {
            console.log(`  Error: ${assignResult.errors[0]?.message}`);
        } else {
            console.log(`  Success! Assigned ${assignResult.data.assignProductsToChannel.length} products`);
        }
    }

    console.log('\nDone!');
}

fixProductChannels().catch(console.error);
