import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/baseTrack'

export default pluginManager =>
  ConfigurationSchema(
    'FilteringTrack',
    {
      subTrack: pluginManager.pluggableConfigSchemaType('track'),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
