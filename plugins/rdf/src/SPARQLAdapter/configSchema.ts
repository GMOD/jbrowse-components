import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SPARQLAdapter
 * #trackType FeatureTrack
 * #category adapter
 * fetches features from a SPARQL endpoint, substituting the queried region into
 * a query template
 *
 * #example
 * `{refName}`, `{start}` and `{end}` are substituted per request, so the
 * endpoint is queried for the visible window rather than the whole genome. The
 * result columns become feature fields, so the query has to select at least
 * `?start`, `?end` and a `?uniqueID`:
 * ```js
 * {
 *   type: 'SPARQLAdapter',
 *   endpoint: { uri: 'https://example.com/sparql' },
 *   queryTemplate: `SELECT ?uniqueID ?start ?end ?strand ?name WHERE {
 *     ?f a :Feature ; :ref "{refName}" ; :start ?start ; :end ?end .
 *     FILTER(?start < {end} && ?end > {start})
 *   }`,
 *   refNamesQueryTemplate: 'SELECT DISTINCT ?refName WHERE { ?f :ref ?refName }',
 * }
 * ```
 */
const SPARQLAdapterConfigSchema = ConfigurationSchema(
  'SPARQLAdapter',
  {
    /**
     * #slot
     */
    endpoint: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'https://somesite.com/sparql',
        locationType: 'UriLocation',
      },
      description: 'URL of the SPARQL endpoint',
    },
    /**
     * #slot
     */
    queryTemplate: {
      type: 'text',
      defaultValue: '',
      description:
        'SPARQL query where {start} {end} and {refName} will get replaced for each call',
    },
    /**
     * #slot
     */
    refNamesQueryTemplate: {
      type: 'text',
      defaultValue: '',
      description:
        'SPARQL query that returns the possible refNames in a ?refName column',
    },
    /**
     * #slot
     */
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Possible refNames used by the SPARQL endpoint (ignored if "refNamesQueryTemplate" is provided)',
    },
    /**
     * #slot
     */
    additionalQueryParams: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Additional parameters to add to the query, e.g. "format=JSON"',
    },
  },
  { explicitlyTyped: true },
)

export default SPARQLAdapterConfigSchema

export type SPARQLAdapterConfig = Instance<typeof SPARQLAdapterConfigSchema>
