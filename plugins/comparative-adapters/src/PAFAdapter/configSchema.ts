import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PAFAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | PAF | Loaded entirely into memory; convert to PIF for large alignments
 * #gotcha `assemblyNames` is `[query, target]`, which is the **reverse** of
 * the order minimap2 and nucmer take their inputs (`minimap2 target.fa
 * query.fa`). Getting it backwards silently draws every alignment against
 * the wrong assembly rather than erroring. Set the named `queryAssembly` and
 * `targetAssembly` fields instead and the ordering can't be misread.
 *
 * #example
 * A PAF has no index, but it needs the query and target assembly names (query
 * first):
 * ```js
 * {
 *   type: 'PAFAdapter',
 *   uri: 'https://example.com/aln.paf',
 *   queryAssembly: 'hg19',
 *   targetAssembly: 'hg38',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        pafLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const PAFAdapter = ConfigurationSchema(
  'PAFAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
    },
    /**
     * #slot
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    },
    /**
     * #slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    },
    /**
     * #slot
     */
    pafLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.paf',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "PAFAdapter",
     *   "uri": "file.paf.gz",
     *   "queryAssembly":"hg19",
     *   "targetAssembly":"hg38"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default PAFAdapter
