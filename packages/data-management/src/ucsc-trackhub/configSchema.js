import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfUCSCTrackHubConnection',
      description: 'a unique name for this connection',
    },
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/path/to/hub.txt' },
      description: 'location of the hub file (usually called hub.txt)',
    },
  },
  { explicitlyTyped: true },
)
