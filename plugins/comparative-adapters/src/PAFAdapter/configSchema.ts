import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pairwiseAssemblyFields } from '../pairwiseAssemblyFields.ts'

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
const PAFAdapter = ConfigurationSchema(
  'PAFAdapter',
  {
    ...pairwiseAssemblyFields,
    /**
     * #slot
     * location of the PAF file (minimap2, wfmash, and similar). May be gzipped.
     * There is no index, so the whole alignment is read into memory — convert
     * anything large with `jbrowse make-pif` and use the
     * `PairwiseIndexedPAFAdapter` instead.
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
