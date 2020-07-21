// NOTE: this jest config should be used by projects in packages/* dirs
module.exports = {
  roots: ['packages/'],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/config/jest/babelTransform.js',
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
    '^(?!.*\\.(ts|js|tsx|jsx|css|json)$)':
      '<rootDir>/config/jest/fileTransform.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(spec|test).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: ['/dist/'],
  collectCoverageFrom: [
    'packages/*/src/**/*.{js,jsx,ts,tsx}',
    // most packages have their src in src/, except for jbrowse-core
    'packages/core/**/*.{js,jsx,ts,tsx}',
  ],
  resolver: 'jest-pnp-resolver',
  setupFiles: [
    '<rootDir>/config/jest/createRange.js',
    '<rootDir>/config/jest/fetchMock.js',
  ],
  setupFilesAfterEnv: ['mobx-react/batchingForReactDom'],
  testEnvironment: 'jest-environment-jsdom-fourteen',
  testURL: 'http://localhost',
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
  },
}
