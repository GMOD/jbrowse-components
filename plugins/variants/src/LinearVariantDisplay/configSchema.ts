import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from 'mobx-state-tree'

/**
 * #config LinearVariantDisplay
 * mostly empty, this display type is very much
 * like a `FeatureTrack` with a `LinearBasicDisplay` except it has a custom
 * feature details widget
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearVariantDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearVariantDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearVariantDisplayConfig =
  Instance<LinearVariantDisplayConfigModel>
