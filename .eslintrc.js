module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'airbnb-base',
    'react-app',
    'plugin:monorepo/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'prettier/react',
    'prettier/@typescript-eslint',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  parserOptions: { ecmaFeatures: { jsx: true } },
  env: {
    browser: true,
  },
  rules: {
    'class-methods-use-this': 'off',
    'import/no-cycle': 'warn',
    'import/prefer-default-export': 'off',
    'monorepo/no-internal-import': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-param-reassign': 'off',
    'no-restricted-syntax': 'off',
    'global-require': 'off',
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
    'react/no-unused-prop-types': 'warn',
    'react/no-unused-state': 'warn',
    'react/prefer-stateless-function': 'warn',
    'react/prop-types': 'warn',
    'react/require-default-props': 'warn',
    '@typescript-eslint/explicit-function-return-type': ['error', { 'allowExpressions': true }],
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/camelcase': 'warn',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  overrides: [
    {
      files: ['packages/generator-jbrowse/**/*'],
      env: { node: true },
      rules: { '@typescript-eslint/no-var-requires': 'off' },
    },
    {
      files: ['**/*.worker.js'],
      globals: { self: true },
      rules: { 'no-restricted-globals': 'off' },
    },
    {
      files: ['**/*.test.[t,j]s'],
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
