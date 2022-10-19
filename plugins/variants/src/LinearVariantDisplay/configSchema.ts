import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

/**
 * !config LinearVariantDisplay
 */
function configSchemaF(pluginManager: PluginManager) {
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
export default configSchemaF

export type LinearVariantDisplayConfigModel = ReturnType<typeof configSchemaF>
export type LinearVariantDisplayConfig =
  Instance<LinearVariantDisplayConfigModel>
