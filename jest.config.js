// NOTE: this jest config should be used by projects in packages/*, products/*,
// and plugins/* dirs
module.exports = {
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

  moduleFileExtensions: ['js', 'ts', 'tsx', 'jsx', 'json', 'node'],
  roots: ['.', 'packages/', 'products/', 'plugins/'],
  setupFiles: [
    '<rootDir>/config/jest/textEncoder.js',
    '<rootDir>/config/jest/fetchMock.js',
    '<rootDir>/config/jest/console.js',
  ],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost' },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(spec|test).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: ['/dist/', '/cypress/', '/demos/'],
  testTimeout: 15000,
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/config/jest/babelTransform.js',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
}
