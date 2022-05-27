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
      description: 'additional URL query values to pass to the REST API',
      type: 'frozen',
      defaultValue: {},
    },
    optional_resources: {
      description:
        'list of optional REST resources that are implemented by this REST API',
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
