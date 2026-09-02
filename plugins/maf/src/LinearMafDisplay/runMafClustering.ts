import {
  clusteredCladeLayout,
  clusterProvenanceFromRegions,
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
  editableSources: MafSource[]
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
    clusteredCladeLayout({
      rows: sources,
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
