import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './SPARQLAdapter'

export const configSchema = ConfigurationSchema(
  'SPARQLAdapter',
  {
    endpoint: {
      type: 'fileLocation',
      defaultValue: { uri: 'https://somesite.com/sparql' },
      description: 'URL of the SPARQL endpoint',
    },
    queryTemplate: {
      type: 'text',
      defaultValue: '',
      desicription:
        'SPARQL query where {start} {end} and {refName} will get replaced for each call',
    },
    refNamesQueryTemplate: {
      type: 'text',
      defaultValue: '',
      desicription:
        'SPARQL query that returns the possible refNames in a ?refName variable',
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
