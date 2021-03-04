import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

export function LinearVariantDisplayConfigFactory(
  pluginManager: PluginManager,
) {
  const configSchema = linearBasicDisplayConfigSchemaFactory(pluginManager)

  return ConfigurationSchema(
    'LinearVariantDisplay',
    {},
    { baseConfiguration: configSchema, explicitlyTyped: true },
  )
}

export type LinearVariantDisplayConfigModel = ReturnType<
  typeof LinearVariantDisplayConfigFactory
>
export type LinearVariantDisplayConfig = Instance<
  LinearVariantDisplayConfigModel
>
