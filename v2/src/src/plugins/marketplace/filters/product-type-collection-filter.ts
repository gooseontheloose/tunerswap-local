import { CollectionFilter, LanguageCode } from '@vendure/core';

/**
 * Custom collection filter that filters products by the productType custom field.
 * This allows collections to be filtered by 'tune', 'part', or 'service'.
 */
export const productTypeCollectionFilter = new CollectionFilter({
    args: {
        productType: {
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'Product Type' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value: 'Filter by product type (tune, part, service)',
                },
            ],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'tune', label: [{ languageCode: LanguageCode.en, value: 'Tunes' }] },
                    { value: 'part', label: [{ languageCode: LanguageCode.en, value: 'Parts' }] },
                    { value: 'service', label: [{ languageCode: LanguageCode.en, value: 'Services' }] },
                ],
            },
        },
    },
    code: 'product-type-filter',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Filter products by their type (tune, part, or service)',
        },
    ],
    apply: (qb, args) => {
        const productType = args.productType;
        // Join to the product table and filter by customFieldsProducttype
        qb.andWhere(`product.customFieldsProducttype = :productType`, { productType });
        return qb;
    },
});
