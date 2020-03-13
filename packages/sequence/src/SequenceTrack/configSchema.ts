import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import DivSequenceRendererConfigurationSchema from '../DivSequenceRenderer/configSchema'

export default (pluginManager: PluginManager, trackType: string) => {
  if (trackType === 'SequenceTrack')
    return ConfigurationSchema(
      'SequenceTrack',
      {
        viewType: 'LinearGenomeView',
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        rendering: DivSequenceRendererConfigurationSchema,
      },
      { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
    )

  // reduced configuration does not inherit from BaseTrack
  // used for when the sequence is in the assembly
  if (trackType === 'ReferenceSequenceTrack')
    return ConfigurationSchema(
      'ReferenceSequenceTrack',
      {
        viewType: 'LinearGenomeView',
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        rendering: DivSequenceRendererConfigurationSchema,
      },
      { explicitIdentifier: 'trackId', explicitlyTyped: true },
    )
  throw new Error('invalid trackType')
}
