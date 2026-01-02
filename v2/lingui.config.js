/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  locales: ['en'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}',
      include: ['src'],
    },
  ],
  format: 'po',
};
