import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'JBrowseRESTFeatureAdapter',
  {
    location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/rest/endpoint',
        locationType: 'UriLocation',
      },
    },
    query: {
      description: 'additional URL query values to pass to the REST endpoint',
      type: 'frozen',
      defaultValue: {}
    },
    unimplemented: {
      description: 'list of REST methods that are not implemented by this REST endpoint',
      type: 'stringArray',
      defaultValue: []
    }
  },
  { explicitlyTyped: true },
)
