import type { Source } from '../util.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ClusterProvenance } from '@jbrowse/tree-sidebar'

export interface ReducedModel extends IStateTreeNode {
  // The rows a run clusters — the focused clade, undecorated. See the model's
  // `clusterableSources`, and `clusteredCladeLayout` for why not `sources`.
  clusterableSources: Source[]
  editableSources: Source[]
  layout: Source[]
  adapterConfig: Record<string, unknown>
  setLayout: (arg: Source[]) => void
  setLayoutAndClusterTree: (
    layout: Source[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}
