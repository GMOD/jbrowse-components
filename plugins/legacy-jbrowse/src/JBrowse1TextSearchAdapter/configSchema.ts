import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config JBrowse1TextSearchAdapter
 * #trackType TextSearchAdapter
 * #fileFormat textsearch | JBrowse 1 names index | From JBrowse 1 `generate-names.pl`
 * note: metadata about tracks and assemblies covered by text search adapter
 *
 * #example
 * An entry in `aggregateTextSearchAdapters`, pointing at the `names/`
 * directory JBrowse 1's `generate-names.pl` wrote — so an existing instance's
 * search index is reused rather than rebuilt with `jbrowse text-index`:
 * ```js
 * {
 *   type: 'JBrowse1TextSearchAdapter',
 *   textSearchAdapterId: 'jbrowse1-names',
 *   namesIndexLocation: { uri: 'https://example.com/jbrowse1/data/names/' },
 *   assemblyNames: ['hg19'],
 * }
 * ```
 */
export default ConfigurationSchema(
  'JBrowse1TextSearchAdapter',
  {
    /**
     * #slot
     */
    namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names', locationType: 'UriLocation' },
      description: 'the location of the JBrowse1 names index data directory',
    },
    /**
     * #slot
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  {
    explicitlyTyped: true,
    /**
     * #identifier
     */
    explicitIdentifier: 'textSearchAdapterId',
  },
)
