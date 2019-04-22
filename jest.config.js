// NOTE: this jest config should be used by projects in packages/* dirs
module.exports = {
  roots: [
    'packages/',
  ],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/config/jest/babelTransform.js',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
    '^(?!.*\\.(ts|js|tsx|jsx|css|json)$)': '<rootDir>/config/jest/fileTransform.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$',
    '^.+\\.module\\.(css|sass|scss)$',
    'generator-jbrowse',
  ],
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/**/*.(spec|test).{js,jsx}',
  ],
  collectCoverageFrom: ['src/**/*.{js,jsx}'],
  resolver: 'jest-pnp-resolver',
  setupFiles: [
    'react-app-polyfill/jsdom',
    '<rootDir>/config/jest/enzymeSetup.js',
  ],
  testEnvironment: 'jsdom',
  testURL: 'http://localhost',
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
  },
  snapshotSerializers: ['enzyme-to-json/serializer'],
}
