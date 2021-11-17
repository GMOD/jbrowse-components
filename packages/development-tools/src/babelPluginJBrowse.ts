// Based on https://github.com/jaredpalmer/tsdx/blob/8b91c747c2235ed4fbf853a39fb6800cbf70b2b3/src/babelPluginTsdx.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createConfigItem } from '@babel/core'
import { createBabelInputPluginFactory } from '@rollup/plugin-babel'
import merge from 'lodash.merge'

// replace lodash with lodash-es, but not lodash/fp
const replacements = [{ original: 'lodash(?!/fp)', replacement: 'lodash-es' }]

function mergeConfigItems(type: any, ...configItemsToMerge: any[]) {
  const mergedItems: any[] = []

  configItemsToMerge.forEach(configItemToMerge => {
    configItemToMerge.forEach((item: any) => {
      const itemToMergeWithIndex = mergedItems.findIndex(
        mergedItem => mergedItem.file.resolved === item.file.resolved,
      )

      if (itemToMergeWithIndex === -1) {
        mergedItems.push(item)
        return
      }

      mergedItems[itemToMergeWithIndex] = createConfigItem(
        [
          mergedItems[itemToMergeWithIndex].file.resolved,
          merge(mergedItems[itemToMergeWithIndex].options, item.options),
        ],
        { type },
      )
    })
  })

  return mergedItems
}

function createConfigItems(type: any, items: any[]) {
  return items.map(({ name, ...options }) => {
    return createConfigItem([require.resolve(name), options], { type })
  })
}

export const babelPluginJBrowse = createBabelInputPluginFactory(() => ({
  // Passed the plugin options.
  options({ custom: customOptions, ...pluginOptions }: any) {
    return {
      // Pull out any custom options that the plugin might have.
      customOptions,

      // Pass the options back with the two custom options removed.
      pluginOptions,
    }
  },
  config(config: any, { customOptions }: any) {
    const defaultPlugins = createConfigItems(
      'plugin',
      [
        // {
        //   name: '@babel/plugin-transform-react-jsx',
        //   pragma: customOptions.jsx || 'h',
        //   pragmaFrag: customOptions.jsxFragment || 'Fragment',
        // },
        { name: 'babel-plugin-macros' },
        { name: 'babel-plugin-annotate-pure-calls' },
        { name: 'babel-plugin-dev-expression' },
        customOptions.format !== 'cjs' && {
          name: 'babel-plugin-transform-rename-import',
          replacements,
        },
        {
          name: 'babel-plugin-polyfill-regenerator',
          // don't pollute global env as this is being used in a library
          method: 'usage-pure',
        },
        { name: '@babel/plugin-proposal-class-properties' },
      ].filter(Boolean),
    )

    const babelOptions = config.options || {}
    babelOptions.presets = babelOptions.presets || []

    const presetEnvIdx = babelOptions.presets.findIndex((preset: any) =>
      preset.file.request.includes('@babel/preset-env'),
    )

    // if they use preset-env, merge their options with ours
    if (presetEnvIdx !== -1) {
      const presetEnv = babelOptions.presets[presetEnvIdx]
      babelOptions.presets[presetEnvIdx] = createConfigItem(
        [
          presetEnv.file.resolved,
          merge({ targets: customOptions.targets }, presetEnv.options, {
            modules: false,
          }),
        ],
        { type: `preset` },
      )
    } else {
      // if no preset-env, add it & merge with their presets
      const defaultPresets = createConfigItems('preset', [
        {
          name: '@babel/preset-env',
          targets: customOptions.targets,
          modules: false,
        },
      ])

      babelOptions.presets = mergeConfigItems(
        'preset',
        defaultPresets,
        babelOptions.presets,
      )
    }

    // Merge babelrc & our plugins together
    babelOptions.plugins = mergeConfigItems(
      'plugin',
      defaultPlugins,
      babelOptions.plugins || [],
    )

    return babelOptions
  },
}))
