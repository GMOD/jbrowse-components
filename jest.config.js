const baseConfig = {
  moduleNameMapper: {
    '^@jbrowse/core/util/useMeasure$':
      '<rootDir>/packages/__mocks__/@jbrowse/core/util/useMeasure.ts',
    '^@jbrowse/core/ui/SanitizedHTML$':
      '<rootDir>/packages/__mocks__/@jbrowse/core/ui/SanitizedHTML.tsx',
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
  ],
  testEnvironmentOptions: { url: 'http://localhost' },
  testTimeout: 15000,
}

export default {
  projects: [
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
