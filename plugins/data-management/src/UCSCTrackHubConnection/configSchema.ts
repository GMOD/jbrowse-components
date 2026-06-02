import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

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
    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, where `uri` points at the hub.txt:
     *
     * ```json
     * {
     *   "type": "UCSCTrackHubConnection",
     *   "uri": "http://mysite.com/path/to/hub.txt"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            hubTxtLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default UCSCTrackHubConnection
