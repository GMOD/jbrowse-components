import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BigBedTextSearchAdapter
 * #trackType TextSearchAdapter
 *
 * Finds features by the names a BigBed was built to look up, its
 * `bedToBigBed -extraIndex` columns, which a UCSC hub declares with
 * `searchIndex`. The hub's `searchTrix` index, when given, adds prefix and
 * case-insensitive matching. A UCSC track hub connection configures one for
 * its first gene track declaring a `searchIndex`, GenArk's `ncbiRefSeq`.
 *
 * #example
 * ```js
 * {
 *   type: 'BigBedTextSearchAdapter',
 *   bigBedLocation: { uri: 'bbi/ncbiRefSeq.bb' },
 *   ixFilePath: { uri: 'ixIxx/ncbiRefSeq.ix' },
 *   ixxFilePath: { uri: 'ixIxx/ncbiRefSeq.ixx' },
 * }
 * ```
 */
const BigBedTextSearchAdapter = ConfigurationSchema(
  'BigBedTextSearchAdapter',
  {
    /**
     * #slot
     * the BigBed whose extra indexes resolve a name to its features
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb', locationType: 'UriLocation' },
    },
    /**
     * #slot
     * a UCSC `searchTrix` `.ix`, whose records are the names the extra
     * indexes hold. Unset, a search matches a name exactly as typed
     */
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
    /**
     * #slot
     * the `.ixx` beside `ixFilePath`
     */
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: '', locationType: 'UriLocation' },
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
  { explicitlyTyped: true },
)

export interface BigBedTextSearchAdapterConfig extends Instance<
  typeof BigBedTextSearchAdapter
> {}
export default BigBedTextSearchAdapter
