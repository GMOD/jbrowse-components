import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseTrackConfig } from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'FeatureTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
      // overrides base
      maxDisplayedBpPerPx: {
        type: 'number',
        description: 'maximum bpPerPx that is displayed in the view',
        defaultValue: 1000,
      },
    },
    { explicitlyTyped: true, baseConfiguration: BaseTrackConfig },
  )
}
