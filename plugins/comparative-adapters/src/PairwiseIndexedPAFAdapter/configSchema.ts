import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'

import { pairwiseAssemblyFields } from '../pairwiseAssemblyFields.ts'

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
    ...pairwiseAssemblyFields,
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
     * from the per-row CIGAR tier (lowercase t/q prefix) to the coarse tier
     * (uppercase T/Q prefix), whose CIGAR is folded to its large indels. The
     * file has the last word: one with no coarse tier (make-pif --no-coarse)
     * serves the fine tier at every zoom, and a threshold below the `--coarse`
     * bound its `#pif` header states is raised to that bound, since below it the
     * coarse tier is served at zooms where the indels it folded away are wide
     * enough to see.
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
