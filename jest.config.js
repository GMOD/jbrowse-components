// NOTE: this jest config should be used by projects in packages/*, products/*,
// and plugins/* dirs
module.exports = {
  roots: ['.', 'packages/', 'products/', 'plugins/'],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'jsx', 'json', 'node'],

  // Use SWC instead of babel-jest for faster transforms (10-20x faster)
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
  },
  transformIgnorePatterns: [
    String.raw`[/\\]node_modules[/\\].+\.(js|jsx)$`,
    String.raw`^.+\.module\.(css|sass|scss)$`,
  ],
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(spec|test).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: ['/dist/', '/cypress/', '/demos/'],
  collectCoverageFrom: [
    'packages/*/src/**/*.{js,jsx,ts,tsx}',
    'products/*/src/**/*.{js,jsx,ts,tsx}',
    'plugins/*/src/**/*.{js,jsx,ts,tsx}',
    // most packages have their src in src/, except for jbrowse-core
    'packages/core/**/*.{js,jsx,ts,tsx}',
  ],
  coveragePathIgnorePatterns: [
    '!*.d.ts',
    'makeWorkerInstance.ts',
    'react-colorful.js',
    'QuickLRU.js',
  ],
  setupFiles: [
    '<rootDir>/config/jest/textEncoder.js',
    '<rootDir>/config/jest/fetchMock.js',
    '<rootDir>/config/jest/console.js',
    '<rootDir>/config/jest/messagechannel.js',
    '<rootDir>/config/jest/structuredClone.js',
  ],
  testEnvironmentOptions: { url: 'http://localhost' },
  testTimeout: 15000,
  testEnvironment: 'jsdom',

  // Persistent cache directory (survives /tmp cleanup)
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Use 50% of CPUs to reduce thrashing
  maxWorkers: '50%',

  // Faster module resolution
  moduleDirectories: ['node_modules'],
}
