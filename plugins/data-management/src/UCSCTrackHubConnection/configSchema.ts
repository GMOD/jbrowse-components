import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config UCSCTrackHubConnection
 *
 * #example
 * An entry in the config's `connections`. The hub's `hub.txt` is read on
 * connect and every track it declares for a matching assembly is added to the
 * session — nothing is written into your config, so the hub stays the source of
 * truth. `assemblyNames` limits which of the hub's genomes are used.
 * ```js
 * {
 *   type: 'UCSCTrackHubConnection',
 *   connectionId: 'ucsc_hub_example',
 *   name: 'My track hub',
 *   assemblyNames: ['hg38'],
 *   hubTxtLocation: { uri: 'https://example.com/hub.txt' },
 * }
 * ```
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
        uri: 'https://mysite.com/path/to/hub.txt',
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
     *   "uri": "https://mysite.com/path/to/hub.txt"
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
