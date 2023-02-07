import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'JBrowseRESTFeatureAdapter',
  {
    location: {
      type: 'fileLocation',
      description: 'the base URL for the REST endpoints of this API',
      defaultValue: {
        uri: 'https://example.com/path/to/my/rest/endpoint',
        locationType: 'UriLocation',
      },
    },
    assemblyNames: {
      type: 'stringArray',
      description:
        'list of assembly names contained in this REST API. only used if the assembly_names optional resource is not implemented',
      defaultValue: [],
    },
    extraQuery: {
      description: 'additional URL query values to pass to the REST API',
      type: 'frozen',
      defaultValue: {},
    },
    optionalResources: ConfigurationSchema(
      'JBrowseRESTFeatureAdapterOptionalResources',
      {
        assembly_names: {
          description:
            'set to true if the REST endpoint provides a list of its configured assemblies',
          type: 'boolean',
          defaultValue: true,
        },
        has_data_for_reference: {
          description:
            'set to true if the REST endpoint provides a list of reference sequence names for its configured assemblies',
          type: 'boolean',
          defaultValue: true,
        },
        reference_sequences: {
          description:
            'set to true if the REST endpoint provides a list of reference sequence names for its configured assemblies',
          type: 'boolean',
          defaultValue: false,
        },
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
