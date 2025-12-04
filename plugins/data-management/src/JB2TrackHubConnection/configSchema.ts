import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config JB2TrackHubConnection
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const JB2TrackHubConnection = ConfigurationSchema(
  'JB2TrackHubConnection',
  {
    /**
     * #slot
     */
    configJsonLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http://mysite.com/path/to/config.json',
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
