import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config TrixTextSearchAdapter
 * #trackType TextSearchAdapter
 * #fileFormat textsearch | Trix index (.ix/.ixx) | Built by `jbrowse text-index`
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return typeof snap.uri === 'string'
    ? {
        ...snap,
        // `uri` points at the `.ix` file; `.ixx` and `_meta.json` sit beside it
        // (the `jbrowse text-index` naming convention), so derive all three
        ixFilePath: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        ixxFilePath: {
          uri: `${snap.uri}x`,
          baseUri: snap.baseUri,
        },
        metaFilePath: {
          uri: `${snap.uri.replace(/\.ix$/, '')}_meta.json`,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const TrixTextSearchAdapter = ConfigurationSchema(
  'TrixTextSearchAdapter',
  {
    /**
     * #slot
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
    metaFilePath: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'meta.json',
        locationType: 'UriLocation',
      },
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
     * an explicit `textSearchAdapterId` is still honored when given
     */
    implicitIdentifier: 'textSearchAdapterId',

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config: `uri` points at the `.ix` file and
     * the sibling `.ixx` and `_meta.json` are derived from it (the
     * `jbrowse text-index` naming convention):
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
