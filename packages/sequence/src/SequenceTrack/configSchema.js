import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { generateBaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import DivSequenceRendererConfigurationSchema from '../DivSequenceRenderer/configSchema'

export default (pluginManager, trackType) => {
  if (trackType === 'SequenceTrack')
    return ConfigurationSchema(
      'SequenceTrack',
      {
        viewType: 'LinearGenomeView',
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        rendering: DivSequenceRendererConfigurationSchema,
      },
      {
        baseConfiguration: generateBaseTrackConfig(pluginManager),
        explicitlyTyped: true,
      },
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
      { explicitlyTyped: true },
    )

  return null
}
