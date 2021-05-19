import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/path/to/hub.txt' },
      description: 'location of the hub file (usually called hub.txt)',
    },
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional list of genomes to import from this track hub, if empty all genomes will be imported',
    },
  },
  { baseConfiguration: baseConnectionConfig },
)
