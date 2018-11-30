import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/model'

export default pluginManager =>
  ConfigurationSchema(
    'AlignmentsTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultView: {
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
