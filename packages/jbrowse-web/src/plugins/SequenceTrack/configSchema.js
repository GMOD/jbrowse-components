import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/baseTrack'

export default pluginManager =>
  // const SequenceRendererConfigSchema = pluginManager.getRendererType(
  //   'DivSequenceRenderer',
  // ).configSchema

  ConfigurationSchema(
    'SequenceTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
