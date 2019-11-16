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
    'global-require': 'off',
    'import/no-cycle': 'warn',
    'import/prefer-default-export': 'off',
    'max-classes-per-file': 'off',
    'monorepo/no-internal-import': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-param-reassign': 'off',
    'no-plusplus': ['error', { 'allowForLoopAfterthoughts': true }],
    'no-restricted-syntax': 'off',
    'no-underscore-dangle': 'warn',
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
    'spaced-comment': ['error', 'always', { 'markers': ['/'] }],
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/camelcase': 'warn',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-var-requires': 'off',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  overrides: [
    // {
    //   "files": ["*.ts", "*.tsx"],
    //   "rules": {
    //     "@typescript-eslint/explicit-function-return-type": ["error"]
    //   }
    // },
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
      },
    },
  ],
}
