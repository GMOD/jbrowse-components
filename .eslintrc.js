module.exports = {
  parser: 'babel-eslint',
  extends: [
    'airbnb-base',
    'react-app',
    'plugin:monorepo/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'prettier/react',
    'prettier/@typescript-eslint',
  ],
  plugins: ['prettier'],
  env: {
    browser: true,
  },
  rules: {
    'class-methods-use-this': 'off',
    'monorepo/no-internal-import': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-param-reassign': 'off',
    'no-restricted-syntax': 'off',
    'no-underscore-dangle': 'warn',
    'no-unused-vars': 'warn',
    'no-use-before-define': 'off',
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: false,
        trailingComma: 'all',
      },
    ],
    'react/destructuring-assignment': 'warn',
    'react/jsx-filename-extension': 'off',
    'react/no-unused-state': 'warn',
    'react/prefer-stateless-function': 'warn',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
  },
  overrides: [
    {
        files: ['packages/generator-jbrowse/**/*'],
        env: {node: true},
        rules: {'@typescript-eslint/no-var-requires': 'off'}
      },
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: { ecmaFeatures: { jsx: true } },
      plugins: ['@typescript-eslint', 'prettier'],
    },
    {
      files: ['**/*.worker.js'],
      globals: { self: true },
      rules: { 'no-restricted-globals': 'off' },
    },
    {
      files: ['**/*.test.js'],
      env: { jest: true },
      globals: {
        document: true,
        it: true,
        describe: true,
        test: true,
      },
      rules: {
        'import/no-extraneous-dependencies': 'off',
        // 'no-restricted-globals': 'off',
      },
    },
  ],
}
