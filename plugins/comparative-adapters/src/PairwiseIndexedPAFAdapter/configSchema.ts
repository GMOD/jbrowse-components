import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'pifGzLocation')
}

/**
 * #config PairwiseIndexedPAFAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Indexed PAF (PIF) | Built by `jbrowse make-pif`; fetches only the visible region
 * a tabix-indexed PAF (PIF) for large synteny datasets. The `uri` shorthand
 * auto-resolves the `.tbi` index (pass `csi: true` for a `.csi` index).
 *
 * #example
 * ```js
 * {
 *   type: 'PairwiseIndexedPAFAdapter',
 *   uri: 'https://example.com/aln.pif.gz',
 *   queryAssembly: 'hg19',
 *   targetAssembly: 'hg38',
 * }
 * ```
 */
const PairwiseIndexedPAFAdapter = ConfigurationSchema(
  'PairwiseIndexedPAFAdapter',
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
    pifGzLocation: {
      type: 'fileLocation',
      description: 'location of pairwise tabix indexed PAF (pif)',
      defaultValue: {
        uri: '/path/to/data/file.pif.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * bpPerPx threshold at which a view on "Level of detail: automatic" switches
     * from the per-row CIGAR tier (lowercase t/q prefix) to the coarse no-CIGAR
     * tier (uppercase T/Q prefix), when make-pif was run with a coarse tier. No
     * coarse tier present in the file = always uses the fine tier. Should be at
     * least make-pif's `--coarse` gap: below it, coarse ribbons are drawn
     * straight across indels wide enough to see.
     */
    coarseBpPerPxThreshold: {
      type: 'number',
      defaultValue: 10000,
      advanced: true,
    },
    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes file.pif.gz.tbi:
     * ```json
     * {
     *   "type": "PairwiseIndexedPAFAdapter",
     *   "uri": "file.pif.gz",
     *   "queryAssembly": "hg19",
     *   "targetAssembly": "hg38"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type PairwiseIndexedPAFAdapterConfig = Instance<
  typeof PairwiseIndexedPAFAdapter
>

export default PairwiseIndexedPAFAdapter
