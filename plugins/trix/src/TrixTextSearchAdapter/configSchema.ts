import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return typeof snap.uri === 'string'
    ? {
        ...snap,
        // `uri` points at the `.ix` file and the `.ixx` sits beside it (the
        // `jbrowse text-index` naming convention), so derive the pair
        ixFilePath: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        ixxFilePath: {
          uri: `${snap.uri}x`,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config TrixTextSearchAdapter
 * #trackType TextSearchAdapter
 * #fileFormat textsearch | Trix index (.ix/.ixx) | Built by `jbrowse text-index`
 *
 * #example
 * `jbrowse text-index` writes this entry into `aggregateTextSearchAdapters` for
 * you. The `uri` shorthand points at the `.ix` and the sibling `.ixx` is derived
 * from it, so the pair only needs spelling out when they are named against
 * convention.
 * ```js
 * {
 *   type: 'TrixTextSearchAdapter',
 *   textSearchAdapterId: 'hg38-index',
 *   uri: 'trix/hg38.ix',
 *   assemblyNames: ['hg38'],
 * }
 * ```
 */
const TrixTextSearchAdapter = ConfigurationSchema(
  'TrixTextSearchAdapter',
  {
    /**
     * #slot
     * location of the Trix `.ix` index written by `jbrowse text-index`: the
     * sorted term-to-feature table the search box reads.
     */
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'out.ix',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * location of the `.ixx` prefix index, which records where in the `.ix`
     * each prefix begins. It is what makes a lookup a couple of range requests
     * instead of a download of the whole index.
     */
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'out.ixx',
        locationType: 'UriLocation',
      },
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
     * an explicit `textSearchAdapterId` is still honored when given
     */
    implicitIdentifier: 'textSearchAdapterId',

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config: `uri` points at the `.ix` file and
     * the sibling `.ixx` is derived from it (the `jbrowse text-index` naming
     * convention):
     * ```json
     * {
     *   "type": "TrixTextSearchAdapter",
     *   "uri": "file.ix",
     *   "assemblyNames": ["hg19"],
     *   "textSearchAdapterId": "hg19SearchIndex"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default TrixTextSearchAdapter
