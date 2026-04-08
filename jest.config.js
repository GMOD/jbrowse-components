// canvas.js patches HTMLCanvasElement (jsdom); not available in pure Node
const setupFilesBase = [
  '<rootDir>/config/jest/textEncoder.js',
  '<rootDir>/config/jest/console.js',
  '<rootDir>/config/jest/messagechannel.js',
  '<rootDir>/config/jest/structuredClone.js',
  '<rootDir>/config/jest/setHTML.js',
]
const setupFilesWithCanvas = [
  ...setupFilesBase,
  '<rootDir>/config/jest/canvas.js',
]

const baseConfig = {
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
  setupFiles: setupFilesWithCanvas,
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
      setupFiles: setupFilesBase,
    },
    {
      // jbrowse-img uses Node environment with native fetch (no jest-fetch-mock)
      displayName: 'jbrowse-img',
      testMatch: ['<rootDir>/products/jbrowse-img/**/*.test.ts'],
      testPathIgnorePatterns: ['/dist/', '/cypress/', '/demos/'],
      testEnvironment: 'node',
      ...baseConfig,
      setupFiles: setupFilesBase,
    },
    {
      // All other tests use jsdom with jest-fetch-mock
      displayName: 'default',
      // Explicit globs (not brace expansion) so tests are discovered on Windows
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
      ],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/config/jest/fetchMockAfterEnv.js'],
      ...baseConfig,
    },
  ],
}
