import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseTrackConfig } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'FeatureTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { explicitlyTyped: true, baseConfiguration: BaseTrackConfig },
  )
}
