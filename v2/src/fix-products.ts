/**
 * Script to fix products without variants and add test data
 * Run with: npx ts-node src/fix-products.ts
 */
import { bootstrap, ProductService, ProductVariantService, ChannelService, LanguageCode, RequestContext } from '@vendure/core';
import { config } from './vendure-config';
import { GlobalFlag } from '@vendure/common/lib/generated-types';

async function fixProducts() {
    console.log('Starting Vendure to fix products...');

    const app = await bootstrap(config);

    const productService = app.get(ProductService);
    const productVariantService = app.get(ProductVariantService);
    const channelService = app.get(ChannelService);

    // Get the default channel to create a proper context
    const defaultChannel = await channelService.getDefaultChannel();

    // Create a superadmin context with the channel
    const ctx = new RequestContext({
        apiType: 'admin',
        isAuthorized: true,
        authorizedAsOwnerOnly: false,
        channel: defaultChannel,
    });

    console.log('\nFetching all products...');
    const products = await productService.findAll(ctx, { take: 1000 });
    console.log(`Found ${products.totalItems} products`);

    let fixedCount = 0;
    const fixedProducts: string[] = [];

    for (const product of products.items) {
        // Check if product has variants - getVariantsByProductId returns PaginatedList
        const variantsResult = await productVariantService.getVariantsByProductId(ctx, product.id);
        const variantCount = variantsResult.items?.length || 0;

        if (variantCount === 0) {
            console.log(`\nFixing: ${product.translations?.[0]?.name || product.id}`);

            const productType = (product as any).customFields?.productType || 'tune';
            const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            const sku = `${productType.toUpperCase()}-${suffix}`;

            // Generate random price between $29 and $499
            const price = Math.floor(Math.random() * 47000) + 2900; // 2900-49900 cents

            const productName = product.translations?.[0]?.name || 'Product';

            try {
                await productVariantService.create(ctx, [{
                    productId: product.id,
                    sku,
                    price,
                    translations: [{
                        languageCode: LanguageCode.en,
                        name: productName,
                    }],
                    stockOnHand: productType === 'tune' ? 999999 : Math.floor(Math.random() * 50) + 10,
                    trackInventory: productType === 'tune' ? GlobalFlag.FALSE : GlobalFlag.TRUE,
                }]);

                console.log(`  ✓ Created variant: ${sku} @ $${(price / 100).toFixed(2)}`);
                fixedProducts.push(`${productName} (${sku})`);
                fixedCount++;
            } catch (err: any) {
                console.log(`  ✗ Error: ${err.message}`);
            }
        } else {
            console.log(`  - ${product.translations?.[0]?.name || product.id}: Already has ${variantCount} variant(s)`);
        }
    }

    console.log('\n========================================');
    console.log(`Fixed ${fixedCount} products`);
    if (fixedProducts.length > 0) {
        console.log('\nProducts fixed:');
        fixedProducts.forEach(p => console.log(`  - ${p}`));
    }
    console.log('========================================\n');

    await app.close();
    process.exit(0);
}

fixProducts().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
