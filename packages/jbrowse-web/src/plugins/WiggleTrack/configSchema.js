import { ConfigurationSchema } from '../../configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '../LinearGenomeView/models/baseTrack'
import WiggleRendererConfigurationSchema from '../WiggleRenderer/configSchema'

export default pluginManager =>
  ConfigurationSchema(
    'WiggleTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      rendering: WiggleRendererConfigurationSchema,
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
