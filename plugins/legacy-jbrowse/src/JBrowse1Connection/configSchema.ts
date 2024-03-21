import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
    assemblyNames: {
      defaultValue: [],
      description:
        'name of the assembly the connection belongs to, should be a single entry',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    dataDirLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'http://mysite.com/jbrowse/data/',
      },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
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

export default JBrowse1Connection
