import { baseConnectionConfig } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'JBrowse1Connection',
  {
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/jbrowse/data/' },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
    },
    assemblyName: {
      description: 'name of the assembly the connection belongs to',
      type: 'string',
      defaultValue: 'assemblyName',
    },
  },
  { baseConfiguration: baseConnectionConfig },
)
