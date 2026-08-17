import {
  buildClusteredLayout,
  clusterProvenanceFromRegions,
  validateClusterOrder,
} from '@jbrowse/tree-sidebar'

import type { MafSource } from './stateModel.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ClusterProvenance, RpcMethodCaller } from '@jbrowse/tree-sidebar'

export type ClusterIdentityMatrixCaller =
  RpcMethodCaller<'LinearMafClusterIdentityMatrix'>

/**
 * What clustering needs off the display, duck-typed: the dialog reaches this
 * through a `lazy()` boundary, where importing the model's own instance type is
 * a circular-reference trap (ADR-055). `IStateTreeNode` rather than
 * `IAnyStateTreeNode`, which is `any` and would check nothing.
 */
export interface MafClusterSelf extends IStateTreeNode {
  sources: MafSource[]
  editableSources: MafSource[] | undefined
  layout: readonly MafSource[]
  adapterConfig: Record<string, unknown>
  setLayout: (layout: MafSource[]) => void
  setLayoutAndClusterTree: (
    layout: MafSource[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}

/**
 * Turn a cluster order into the display's next `layout`. One home, because the
 * auto ("Run clustering") and manual (R script paste) paths both take it and
 * would otherwise drift.
 *
 * `sources` is the row set the display is DRAWING, and it is what the order
 * indexes -- the same array is sent to the worker and applied here. Under an
 * active subtree filter that means a run resolves the structure WITHIN the
 * clade rather than handing back the whole-cohort tree, which is both the more
 * useful answer and the only one `computeClusterHierarchy` will draw: it refuses
 * a tree whose leaves are not exactly the drawn rows in order.
 *
 * The rows a subtree filter is hiding are re-appended rather than dropped.
 * `layout` is the persisted record of every row's position and colour, so
 * losing them here would erase them for good the moment the filter is cleared.
 */
export function clusteredMafLayout({
  sources,
  editableSources,
  layout,
  order,
}: {
  sources: MafSource[]
  editableSources: MafSource[] | undefined
  layout: readonly MafSource[]
  order: number[]
}): MafSource[] {
  validateClusterOrder(order, sources.length)
  const clustered = buildClusteredLayout(sources, [...layout], order)
  const clusteredNames = new Set(clustered.map(s => s.name))
  return [
    ...clustered,
    ...(editableSources ?? []).filter(s => !clusteredNames.has(s.name)),
  ]
}

/**
 * The real "Cluster rows by identity" run, over the per-bin identity matrix.
 * One home, so the dialog's button and the declarative session-triggered run
 * (`setupRunClusteringAutorun`, installed in the display's afterAttach) call the
 * same code rather than two copies drifting apart.
 */
export async function runMafClustering({
  model,
  rpcManager,
  sessionId,
  regions,
  stopToken,
  statusCallback,
}: {
  model: MafClusterSelf
  rpcManager: ClusterIdentityMatrixCaller
  sessionId: string
  regions: Region[]
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const { sources, adapterConfig } = model
  if (!sources.length) {
    return
  }
  const ret = await rpcManager.call(
    sessionId,
    'LinearMafClusterIdentityMatrix',
    {
      regions,
      sources: sources.map(s => s.name),
      adapterConfig,
      stopToken,
      statusCallback,
    },
  )
  model.setLayoutAndClusterTree(
    clusteredMafLayout({
      sources,
      editableSources: model.editableSources,
      layout: model.layout,
      order: ret.order,
    }),
    ret.tree,
    // The locus is the whole provenance here. Nothing else changes which
    // columns entered the matrix -- the bin count is fixed and every row of the
    // window is scored -- where the genotype path has filters and a rendering
    // mode that do.
    clusterProvenanceFromRegions(regions),
  )
}
