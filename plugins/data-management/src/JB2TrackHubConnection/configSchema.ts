import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config JB2TrackHubConnection
 *
 * #example
 * An entry in the config's `connections`, pointing at another JBrowse 2
 * `config.json`. Its tracks — and any assemblies it declares that the session
 * lacks — are added on connect, so one instance can publish a track set that
 * others subscribe to.
 * ```js
 * {
 *   type: 'JB2TrackHubConnection',
 *   connectionId: 'jb2_hub_example',
 *   name: 'Shared JBrowse 2 tracks',
 *   assemblyNames: ['hg38'],
 *   configJsonLocation: { uri: 'https://example.com/jbrowse/config.json' },
 * }
 * ```
 */

const JB2TrackHubConnection = ConfigurationSchema(
  'JB2TrackHubConnection',
  {
    /**
     * #slot
     */
    configJsonLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'https://mysite.com/path/to/config.json',
        locationType: 'UriLocation',
      },
      description:
        'location of the jb2 config file (usually called config.json)',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional list of genomes to import from this config.json, if empty all genomes will be imported',
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
     * preprocessor to allow minimal config, where `uri` points at the jb2
     * config.json:
     *
     * ```json
     * {
     *   "type": "JB2TrackHubConnection",
     *   "uri": "https://mysite.com/path/to/config.json"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            configJsonLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default JB2TrackHubConnection
