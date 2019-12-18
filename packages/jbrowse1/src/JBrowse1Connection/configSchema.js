import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'JBrowse1Connection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfJBrowse1Connection',
      description: 'a unique name for this connection',
    },
    dataDirLocation: {
      type: 'fileLocation',
      defaultValue: { uri: 'http://mysite.com/jbrowse/data/' },
      description:
        'the location of the JBrowse 1 data directory, often something like http://mysite.com/jbrowse/data/',
    },
  },
  { explicitlyTyped: true },
)
