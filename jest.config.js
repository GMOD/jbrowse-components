// NOTE: this jest config should be used by projects in packages/*, products/*,
// and plugins/* dirs
module.exports = {
  roots: ['.', 'packages/', 'products/', 'plugins/'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/config/jest/babelTransform.js',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
    '^(?!.*\\.(ts|js|tsx|jsx|css|json)$)':
      '<rootDir>/config/jest/fileTransform.js',
  },
  testPathIgnorePatterns: ['/dist/', '/cypress/', '/embedded_demos/'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '!*.d.ts',
    'makeWorkerInstance.ts',
    'react-colorful.js',
    'QuickLRU.js',
  ],
  setupFiles: [
    '<rootDir>/config/jest/textEncoder.js',
    '<rootDir>/config/jest/fetchMock.js',
    '<rootDir>/config/jest/console.js',
    '<rootDir>/config/jest/crypto.js',
    '<rootDir>/node_modules/jest-offline',
    'jest-localstorage-mock',
  ],
  testEnvironmentOptions: { url: 'http://localhost' },
  testEnvironment: 'jsdom',
}
