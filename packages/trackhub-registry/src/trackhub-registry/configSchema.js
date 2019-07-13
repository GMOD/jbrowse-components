import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'TrackHubRegistryConnection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfTrackHubRegistryConnection',
      description: 'a unique name for this connection',
    },
    trackDbId: {
      type: 'string',
      defaultValue: '',
      description: 'id of the trackDb in The Track Hub Registry',
    },
  },
  { explicitlyTyped: true },
)
