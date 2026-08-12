import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config JBrowse1Connection
 *
 * #example
 * An entry in the config's `connections`, pointing at a JBrowse 1 data
 * directory — the one holding `trackList.json` and `seq/`. Its tracks are
 * translated to JBrowse 2 equivalents on connect, which is the path for serving
 * an existing JBrowse 1 instance's data without re-processing it.
 * ```js
 * {
 *   type: 'JBrowse1Connection',
 *   connectionId: 'jbrowse1_example',
 *   name: 'Legacy JBrowse 1 data',
 *   assemblyNames: ['hg19'],
 *   dataDirLocation: { uri: 'https://example.com/jbrowse1/data/' },
 * }
 * ```
 */

const JBrowse1Connection = ConfigurationSchema(
  'JBrowse1Connection',
  {
    /**
     * #slot
     */
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'https://mysite.com/jbrowse/data/',
        locationType: 'UriLocation',
      },
      description:
        'the location of the JBrowse 1 data directory, often something like https://mysite.com/jbrowse/data/',
    },
    /**
     * #slot
     */
    assemblyNames: {
      description:
        'name of the assembly the connection belongs to, should be a single entry',
      type: 'stringArray',
      defaultValue: [],
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: baseConnectionConfig,
  },
)

export default JBrowse1Connection
