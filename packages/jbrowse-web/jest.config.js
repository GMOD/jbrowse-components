/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('../../config/jest/jest.config')

module.exports = {
  ...baseConfig,
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
