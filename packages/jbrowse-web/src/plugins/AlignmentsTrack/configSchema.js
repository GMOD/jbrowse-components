import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/model'

export default pluginManager =>
  ConfigurationSchema(
    'AlignmentsTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'string',
        defaultValue: 'pileup',
      },
      category: {
        type: 'stringArray',
        defaultValue: [],
      },
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
