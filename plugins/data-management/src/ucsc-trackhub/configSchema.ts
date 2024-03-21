import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
    assemblyNames: {
      defaultValue: [],
      description:
        'optional list of genomes to import from this track hub, if empty all genomes will be imported',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    hubTxtLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'http://mysite.com/path/to/hub.txt',
      },
      description: 'location of the hub file (usually called hub.txt)',
      type: 'fileLocation',
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
