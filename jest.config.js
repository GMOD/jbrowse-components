const baseConfig = {
  moduleNameMapper: {
    '^@jbrowse/core/util/useMeasure$':
      '<rootDir>/packages/__mocks__/@jbrowse/core/util/useMeasure.ts',
    '^@jbrowse/text-indexing-core$':
      '<rootDir>/packages/text-indexing-core/src/index.ts',
    '^@jbrowse/test-utils$': '<rootDir>/packages/test-utils/src/index.ts',
    '^@jbrowse/plugin-alignments$': '<rootDir>/plugins/alignments/src/index.ts',
    '^@jbrowse/plugin-config$': '<rootDir>/plugins/config/src/index.ts',
    '^@jbrowse/plugin-hic$': '<rootDir>/plugins/hic/src/index.ts',
    '^@jbrowse/plugin-linear-genome-view$':
      '<rootDir>/plugins/linear-genome-view/src/index.ts',
    '^@jbrowse/plugin-sequence$': '<rootDir>/plugins/sequence/src/index.ts',
    '^@jbrowse/plugin-variants$': '<rootDir>/plugins/variants/src/index.ts',
    '^@jbrowse/web/src/(.*)\\.js$': '<rootDir>/products/jbrowse-web/src/$1.ts',
    '^@jbrowse/web/src/(.*)$': '<rootDir>/products/jbrowse-web/src/$1.ts',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/config/jest/babelTransform.cjs',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.cjs',
  },
  transformIgnorePatterns: [
    '/node_modules/.+\\.(js|jsx)$',
    '\\.module\\.(css|sass|scss)$',
  ],
  collectCoverageFrom: [
    '{packages,products,plugins}/*/src/**/*.{js,jsx,ts,tsx}',
  ],
  coveragePathIgnorePatterns: [
    '!*.d.ts',
    'makeWorkerInstance.ts',
    'react-colorful.js',
    'QuickLRU.js',
  ],
  setupFiles: [
    '<rootDir>/config/jest/textEncoder.js',
    '<rootDir>/config/jest/console.js',
    '<rootDir>/config/jest/messagechannel.js',
    '<rootDir>/config/jest/structuredClone.js',
    '<rootDir>/config/jest/setHTML.js',
  ],
  testEnvironmentOptions: { url: 'http://localhost' },
  testTimeout: 15000,
}

export default {
  projects: [
    {
      // Root-level integration test
      displayName: 'integration',
      testMatch: ['<rootDir>/integration.test.js'],
      testEnvironment: 'node',
      ...baseConfig,
    },
    {
      // jbrowse-img uses Node environment with native fetch (no jest-fetch-mock)
      displayName: 'jbrowse-img',
      testMatch: ['<rootDir>/products/jbrowse-img/**/*.test.ts'],
      testPathIgnorePatterns: ['/dist/', '/cypress/', '/demos/'],
      testEnvironment: 'node',
      ...baseConfig,
    },
    {
      // All other tests use jsdom with jest-fetch-mock
      displayName: 'default',
      testMatch: [
        '<rootDir>/{packages,products,plugins}/**/*.test.{ts,tsx,js,jsx}',
      ],
      testPathIgnorePatterns: [
        '/dist/',
        '/cypress/',
        '/demos/',
        '<rootDir>/products/jbrowse-img/',
      ],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/config/jest/fetchMockAfterEnv.js'],
      ...baseConfig,
    },
  ],
}
