import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'SPARQLAdapter',
  {
    additionalQueryParams: {
      defaultValue: [],
      description:
        'Additional parameters to add to the query, e.g. "format=JSON"',
      type: 'stringArray',
    },
    endpoint: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'https://somesite.com/sparql',
      },
      description: 'URL of the SPARQL endpoint',
      type: 'fileLocation',
    },
    queryTemplate: {
      defaultValue: '',
      description:
        'SPARQL query where {start} {end} and {refName} will get replaced for each call',
      type: 'text',
    },
    refNames: {
      defaultValue: [],
      description:
        'Possible refNames used by the SPARQL endpoint (ignored if "refNamesQueryTemplate" is provided)',
      type: 'stringArray',
    },
    refNamesQueryTemplate: {
      defaultValue: '',
      description:
        'SPARQL query that returns the possible refNames in a ?refName column',
      type: 'text',
    },
  },
  { explicitlyTyped: true },
)
