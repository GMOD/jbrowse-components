import baseConnectionConfig from '@gmod/jbrowse-core/baseConnectionConfig'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'TheTrackHubRegistryConnection',
  {
    trackDbId: {
      type: 'string',
      defaultValue: '',
      description: 'id of the trackDb in The Track Hub Registry',
    },
  },
  { baseConfiguration: baseConnectionConfig },
)
