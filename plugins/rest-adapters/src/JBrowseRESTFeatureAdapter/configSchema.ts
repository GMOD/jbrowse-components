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
    extra_query: {
      description: 'additional URL query values to pass to the REST API',
      type: 'frozen',
      defaultValue: {},
    },
    optional_resources: ConfigurationSchema(
      'JBrowseRESTFeatureAdapterOptionalResources',
      {
        region_stats: {
          description:
            'set to true if the REST endpoint provides region statistics',
          type: 'boolean',
          defaultValue: false,
        },
        region_feature_densities: {
          description:
            'set to true if the REST endpoint provides region feature densities',
          type: 'boolean',
          defaultValue: false,
        },
      },
    ),
  },
  { explicitlyTyped: true },
)
