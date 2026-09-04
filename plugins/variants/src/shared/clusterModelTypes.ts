import type { ProcessedSource, SampleInfo, Source } from './types.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ClusterProvenance } from '@jbrowse/tree-sidebar'

export interface ReducedModel extends IStateTreeNode {
  layout: Source[]
  // The rows the display is showing: layout-ordered and subtree-filtered, and
  // already haplotype-expanded once a phased clustering has written `layout`.
  // What both clustering paths cluster, so a re-run inside a filtered clade
  // resolves that clade rather than the whole cohort.
  sourcesBase?: ProcessedSource[]
  // Always resolved off a config slot with a default (0 / 1), so both clustering
  // entry points forward the display's real thresholds rather than restating
  // "off" defaults of their own.
  minorAlleleFrequencyFilter: number
  maxMissingnessFilter: number
  filters?: SerializableFilterChain
  adapterConfig: Record<string, unknown>
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
  // Whether the fetched inputs clustering needs have arrived. Phased mode
  // clusters haplotypes, which needs per-sample ploidy from `sampleInfo` — and
  // that rides with `cellData`, later than the header-only `sourcesVolatile`.
  // On this interface rather than only on the autorun's own type because BOTH
  // entry points have to gate on it: run before it, and `buildGenotypeMatrix`
  // silently builds the sample-level matrix instead, so the tree's leaves
  // ("HG001") never match the haplotype rows ("HG001 HP0") and
  // `treeDescribesRows` refuses to draw the dendrogram the run just produced.
  clusteringReady: boolean
  // Whether there are at least two rows to put in an order, counted on the list
  // the run actually clusters. Both entry points gate on it for the same reason
  // they both gate on `clusteringReady`: the dialog's Run button and the
  // declarative autorun would otherwise spend a whole genotype-matrix pass to
  // hand back a one-leaf dendrogram — which `clusterMatrix` now refuses outright
  // (MIN_CLUSTER_ROWS), so ungated it is an error dialog rather than a no-op.
  hasClusterableRows: boolean
  setLayout: (arg: Source[]) => void
  setLayoutAndClusterTree: (
    layout: Source[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}
