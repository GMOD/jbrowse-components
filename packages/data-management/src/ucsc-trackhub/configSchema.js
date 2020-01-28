import baseConnectionConfig from '@gmod/jbrowse-core/baseConnectionConfig'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/path/to/hub.txt' },
      description: 'location of the hub file (usually called hub.txt)',
    },
  },
  { baseConfiguration: baseConnectionConfig },
)
