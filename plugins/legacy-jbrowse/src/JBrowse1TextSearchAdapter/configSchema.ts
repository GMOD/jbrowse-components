import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config JBrowse1TextSearchAdapter
 * #trackType TextSearchAdapter
 * #fileFormat textsearch | JBrowse 1 names index | From JBrowse 1 `generate-names.pl`
 * Searches a names index written by JBrowse 1's `generate-names.pl`. The
 * `assemblyNames` slot lists the assemblies the index covers; the index itself
 * names the tracks each hit is in.
 *
 * #example
 * An entry in `aggregateTextSearchAdapters`, pointing at the `names/`
 * directory JBrowse 1's `generate-names.pl` wrote — so an existing instance's
 * search index is reused rather than rebuilt with `jbrowse text-index`:
 * ```js
 * {
 *   type: 'JBrowse1TextSearchAdapter',
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
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  {
    explicitlyTyped: true,
    closed: true,
    // v4 declared a `tracks` slot nothing read: the index's own track list
    // names each hit's track
    retired: {
      tracks: () => ({}),
    },
  },
)
