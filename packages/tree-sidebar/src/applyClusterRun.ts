import { clusteredCladeLayout } from './clusterUtils.ts'
import { rotateClusterRun } from './rotateClusterRun.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'

export interface ClusterRunModel<S extends { name: string }> {
  editableSources: S[]
  rowDomain: string[]
  setRowOrder: (
    rows: S[],
    run?: { tree?: string; provenance?: ClusterProvenance },
  ) => void
}

/**
 * Run a clustering matrix over `rows` and land the layout and tree together.
 * The row lists are read before the run, so a filter change while the worker
 * is busy cannot pair the order it hands back with a different row list.
 *
 * The run composes with the config `domain` rather than overwriting it:
 * `rotateClusterRun` turns the dendrogram towards the declared order and reads
 * the row order back off it, so a domain-seeded track keeps its leading rows as
 * early as the topology allows and still draws the tree.
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
  const { editableSources, rowDomain } = model
  const { order, tree } = rotateClusterRun({
    rows,
    domain: rowDomain,
    ...(await matrix()),
  })
  model.setRowOrder(clusteredCladeLayout({ rows, editableSources, order }), {
    tree,
    provenance,
  })
}
