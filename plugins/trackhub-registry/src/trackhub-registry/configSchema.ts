import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config TheTrackHubRegistryConnection
 */
export default ConfigurationSchema(
  'TheTrackHubRegistryConnection',
  {
    /**
     * !slot
     */
    trackDbId: {
      type: 'string',
      defaultValue: '',
      description: 'id of the trackDb in The Track Hub Registry',
    },
  },
  {
    /**
     * !baseConfiguration
     */
    baseConfiguration: baseConnectionConfig,
  },
)
