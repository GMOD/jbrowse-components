import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'SPARQLAdapter',
  {
    endpoint: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'https://somesite.com/sparql',
        locationType: 'UriLocation',
      },
      description: 'URL of the SPARQL endpoint',
    },
    queryTemplate: {
      type: 'text',
      defaultValue: '',
      description:
        'SPARQL query where {start} {end} and {refName} will get replaced for each call',
    },
    refNamesQueryTemplate: {
      type: 'text',
      defaultValue: '',
      description:
        'SPARQL query that returns the possible refNames in a ?refName column',
    },
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Possible refNames used by the SPARQL endpoint (ignored if "refNamesQueryTemplate" is provided)',
    },
    additionalQueryParams: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Additional parameters to add to the query, e.g. "format=JSON"',
    },
  },
  { explicitlyTyped: true },
)
