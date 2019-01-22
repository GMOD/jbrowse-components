import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/baseTrack'
import DivSequenceRendererConfigurationSchema from '../DivSequenceRenderer/configSchema'

export default pluginManager =>
  ConfigurationSchema(
    'SequenceTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      rendering: DivSequenceRendererConfigurationSchema,
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
