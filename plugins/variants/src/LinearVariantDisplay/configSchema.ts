import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LinearVariantDisplay
 *
 * mostly empty, this display type is very much like a `FeatureTrack` with a
 * `LinearBasicDisplay` except it has a custom feature details widget
 *
 * extends
 * - [LinearBasicDisplay](../linearbasicdisplay)
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
