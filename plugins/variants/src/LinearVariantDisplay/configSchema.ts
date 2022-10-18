import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

/**
 * !config LinearVariantDisplay
 */
export function LinearVariantDisplayConfigFactory(
  pluginManager: PluginManager,
) {
  return ConfigurationSchema(
    'LinearVariantDisplay',
    {},
    {
      /**
       * !baseConfiguration
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearVariantDisplayConfigModel = ReturnType<
  typeof LinearVariantDisplayConfigFactory
>
export type LinearVariantDisplayConfig =
  Instance<LinearVariantDisplayConfigModel>
