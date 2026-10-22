import type { Source } from '../util.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ClusterRunModel } from '@jbrowse/tree-sidebar'

export interface ReducedModel extends IStateTreeNode, ClusterRunModel<Source> {
  // The rows a run clusters — the focused clade, undecorated. See the model's
  // `clusterableSources`, and `clusteredCladeLayout` for why not `sources`.
  clusterableSources: Source[]
  adapterConfig: Record<string, unknown>
  yField: string
  // the y scale, which the matrix's scores are placed through
  scaleType: string
  domain: [number, number] | undefined
  symlogConstant: number
}
