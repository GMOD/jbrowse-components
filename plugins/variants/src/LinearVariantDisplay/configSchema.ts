import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { featuresTrackConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export function LinearVariantDisplayConfigFactory(
  pluginManager: PluginManager,
) {
  const configSchema = featuresTrackConfigSchema(pluginManager)

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
