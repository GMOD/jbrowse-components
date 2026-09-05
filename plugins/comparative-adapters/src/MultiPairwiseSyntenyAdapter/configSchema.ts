import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MultiPairwiseSyntenyAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Several pairwise alignments sharing one genome | One anchor genome aligned to each of N others, as N pairwise files
 * Composes pairwise synteny adapters that all name one assembly — the anchor —
 * into the star an N-genome view draws from one track: hg38 against each UCSC
 * genome's liftOver PIF, say. A query on the anchor fans out to every child and
 * concatenates; a query naming one mate reaches only the child holding that
 * pair, which a PIF answers from the mate's own perspective; a mate pair no
 * child aligns is empty rather than an error, since a star has no such edge.
 *
 * The anchor is inferred as the one assembly every child names, so it is never
 * written twice. Each child is any pairwise synteny adapter config with its own
 * `assemblyNames` (PairwiseIndexedPAFAdapter, PAFAdapter, ChainAdapter, ...).
 *
 * #example
 * ```js
 * {
 *   type: 'MultiPairwiseSyntenyAdapter',
 *   adapters: [
 *     {
 *       type: 'PairwiseIndexedPAFAdapter',
 *       uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz',
 *       csi: true,
 *       assemblyNames: ['panTro6', 'hg38'],
 *     },
 *     {
 *       type: 'PairwiseIndexedPAFAdapter',
 *       uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToGorGor6.over.pif.gz',
 *       csi: true,
 *       assemblyNames: ['gorGor6', 'hg38'],
 *     },
 *   ],
 * }
 * ```
 */
const MultiPairwiseSyntenyAdapter = ConfigurationSchema(
  'MultiPairwiseSyntenyAdapter',
  {
    /**
     * #slot
     * the pairwise adapter configs, each naming its own pair in
     * `assemblyNames` (or `queryAssembly`/`targetAssembly`); exactly one
     * assembly must be common to all of them
     */
    adapters: {
      type: 'frozen',
      defaultValue: [],
      description:
        'array of pairwise synteny adapter configs sharing one assembly',
    },
    /**
     * #slot
     * bpPerPx threshold at which a view on "Level of detail: automatic" switches
     * the children from their fine tier to their coarse tier. The coarse tier
     * is offered only when every child carries one, and the threshold is raised
     * to the largest `--coarse` bound any child's `#pif` header states.
     */
    coarseBpPerPxThreshold: {
      type: 'number',
      defaultValue: 10000,
      advanced: true,
    },
  },
  { explicitlyTyped: true },
)

export type MultiPairwiseSyntenyAdapterConfig = Instance<
  typeof MultiPairwiseSyntenyAdapter
>

export default MultiPairwiseSyntenyAdapter
