// NOTE: this jest config should be used by projects in packages/* dirs
module.exports = {
  projects: [
    'packages/*',
  ],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': '<rootDir>/../../config/jest/babelTransform.js',
    '^.+\\.css$': '<rootDir>/../../config/jest/cssTransform.js',
    '^(?!.*\\.(ts|js|tsx|jsx|css|json)$)': '<rootDir>/../../config/jest/fileTransform.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/?(*.)(spec|test).{js,jsx}',
  ],
}
