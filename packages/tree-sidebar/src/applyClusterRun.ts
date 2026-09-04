import { clusteredCladeLayout } from './clusterUtils.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'

export interface ClusterRunModel<S extends { name: string }> {
  editableSources: S[]
  layout: readonly S[]
  setLayoutAndClusterTree: (
    layout: S[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}

/**
 * Run a clustering matrix over `rows` and land the layout and tree together.
 * The row lists are read before the run, so a filter change while the worker
 * is busy cannot pair the order it hands back with a different row list.
 */
export async function applyClusterRun<S extends { name: string }>({
  model,
  rows,
  provenance,
  matrix,
}: {
  model: ClusterRunModel<S>
  rows: S[]
  provenance: ClusterProvenance
  matrix: () => Promise<{ order: number[]; tree?: string }>
}) {
  const { editableSources, layout } = model
  const { order, tree } = await matrix()
  model.setLayoutAndClusterTree(
    clusteredCladeLayout({ rows, editableSources, layout, order }),
    tree,
    provenance,
  )
}
