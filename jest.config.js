const baseConfig = {
  maxWorkers: '25%',
  moduleNameMapper: {
    '^@jbrowse/core/util/useMeasure$':
      '<rootDir>/packages/__mocks__/@jbrowse/core/util/useMeasure.ts',
    '^@jbrowse/text-indexing-core$':
      '<rootDir>/packages/text-indexing-core/src/index.ts',
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
    'packages/*/src/**/*.{js,jsx,ts,tsx}',
    'products/*/src/**/*.{js,jsx,ts,tsx}',
    'plugins/*/src/**/*.{js,jsx,ts,tsx}',
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
      // gfa-to-tabix CLI tests: run in Node, auto-build Rust binary if cargo is available
      displayName: 'gfa-to-tabix',
      testMatch: [
        '<rootDir>/products/jbrowse-cli/src/commands/make-gfa-tabix/gfa-to-tabix.test.ts',
      ],
      testEnvironment: 'node',
      globalSetup: '<rootDir>/config/jest/buildGfaTabix.cjs',
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
        '<rootDir>/packages/**/*.test.{ts,tsx,js,jsx}',
        '<rootDir>/products/**/*.test.{ts,tsx,js,jsx}',
        '<rootDir>/plugins/**/*.test.{ts,tsx,js,jsx}',
      ],
      testPathIgnorePatterns: [
        '/dist/',
        '/cypress/',
        '/demos/',
        '<rootDir>/products/jbrowse-img/',
        '<rootDir>/products/jbrowse-cli/src/commands/make-gfa-tabix/gfa-to-tabix.test.ts',
      ],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/config/jest/fetchMockAfterEnv.js',
        '<rootDir>/config/jest/swrCache.js',
      ],
      ...baseConfig,
    },
  ],
}
