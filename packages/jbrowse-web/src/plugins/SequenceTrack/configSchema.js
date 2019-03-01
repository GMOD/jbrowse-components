import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/baseTrack'
import DivSequenceRendererConfigurationSchema from '../DivSequenceRenderer/configSchema'

export default (pluginManager, trackType) => {
  if (trackType === 'SequenceTrack')
    return ConfigurationSchema(
      'SequenceTrack',
      {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        rendering: DivSequenceRendererConfigurationSchema,
      },
      { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
    )

  if (trackType === 'ReferenceSequence')
    return ConfigurationSchema(
      'ReferenceSequence',
      {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        rendering: DivSequenceRendererConfigurationSchema,
      },
      { explicitlyTyped: true },
    )

  return null
}
