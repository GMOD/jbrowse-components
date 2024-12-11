import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config UCSCTrackHubConnection
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const UCSCTrackHubConnection = ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    /**
     * #slot
     */
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http://mysite.com/path/to/hub.txt',
        locationType: 'UriLocation',
      },
      description: 'location of the hub file (usually called hub.txt)',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional list of genomes to import from this track hub, if empty all genomes will be imported',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseConnectionConfig,
  },
)

export default UCSCTrackHubConnection
