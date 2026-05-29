import { babelOptions } from '../../../webpack/config/webpack.config.ts'

import type { StorybookConfig } from '@storybook/react-webpack5'

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  staticDirs: ['../public'],

  webpackFinal: async config => {
    const isJsTsBabelRule = (rule: unknown): boolean => {
      if (!rule || typeof rule !== 'object') return false
      const r = rule as Record<string, unknown>
      const testStr = r['test']?.toString() ?? ''
      if (!/[tj]sx?/.test(testStr)) return false
      return JSON.stringify(r['use'] ?? r['loader'] ?? '').includes('babel-loader')
    }

    const filteredRules = (config.module!.rules ?? []).flatMap(rule => {
      if (!rule || typeof rule === 'string') return [rule]
      const r = rule as Record<string, unknown>
      if (Array.isArray(r['oneOf'])) {
        const oneOf = r['oneOf'].filter((x: unknown) => !isJsTsBabelRule(x))
        return oneOf.length ? [{ ...r, oneOf }] : []
      }
      return isJsTsBabelRule(rule) ? [] : [rule]
    })

    config.module!.rules = [
      ...filteredRules,
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: babelOptions,
      },
    ]

    config.resolve = {
      ...config.resolve,
      extensions: ['.mjs', '.js', '.ts', '.tsx', '.jsx', '.json'],
    }

    return config
  },
}

export default config
