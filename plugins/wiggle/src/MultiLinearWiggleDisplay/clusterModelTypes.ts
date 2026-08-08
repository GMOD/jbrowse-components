import type { Source } from '../util.ts'
import type { ClusterProvenance } from '@jbrowse/tree-sidebar'

export interface ReducedModel {
  sourcesWithoutLayout: Source[]
  layout: Source[]
  adapterConfig: Record<string, unknown>
  setLayout: (arg: Source[]) => void
  setLayoutAndClusterTree: (
    layout: Source[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}
