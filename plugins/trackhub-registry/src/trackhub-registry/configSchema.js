import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
