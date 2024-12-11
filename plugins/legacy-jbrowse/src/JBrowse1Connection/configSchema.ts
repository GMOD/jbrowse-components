import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'

/**
 * #config JBrowse1Connection
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const JBrowse1Connection = ConfigurationSchema(
  'JBrowse1Connection',
  {
    /**
     * #slot
     */
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http://mysite.com/jbrowse/data/',
        locationType: 'UriLocation',
      },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
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
