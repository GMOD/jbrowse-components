import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config UCSCTrackHubConnection
 */
const UCSCTrackHubConnection = ConfigurationSchema(
  'UCSCTrackHubConnection',
  {
    /**
     * #slot
     */
    hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: {
        // uri: 'http://mysite.com/path/to/hub.txt',
        uri: 'https://hgdownload.soe.ucsc.edu/hubs/GCF/000/002/985/GCF_000002985.6/hub.txt',
        locationType: 'UriLocation',
      },
      description:
        'location of the hub file (usually called hub.txt or trackDb.txt)',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'list of assemblies (genomes) to import from this UCSC hub. optional for assembly hubs, but required for track hubs',
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
