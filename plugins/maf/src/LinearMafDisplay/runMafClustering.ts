import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MafSource } from '../types.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ClusterRunModel, RpcMethodCaller } from '@jbrowse/tree-sidebar'

export type ClusterIdentityMatrixCaller =
  RpcMethodCaller<'LinearMafClusterIdentityMatrix'>

/**
 * What clustering needs off the display, duck-typed: the dialog reaches it
 * through a `lazy()` boundary, where importing the model's instance type is a
 * circular-reference trap (ADR-055). `IStateTreeNode` rather than
 * `IAnyStateTreeNode`, which is `any`.
 */
export interface MafClusterSelf
  extends IStateTreeNode, ClusterRunModel<MafSource> {
  clusterableSources: MafSource[]
  autoClusterReady: boolean
  adapterConfig: Record<string, unknown>
  resolvedByteLimit: () => number | undefined
  setRowOrder: (rows: MafSource[]) => void
}

/**
 * The real "Cluster rows by identity" run, over the per-bin identity matrix.
 * The dialog's button and the session-triggered run
 * (`setupRunClusteringAutorun`) share it.
 */
export async function runMafClustering({
  model,
  rpcManager,
  sessionId,
  regions,
  signal,
  statusCallback,
}: {
  model: MafClusterSelf
  rpcManager: ClusterIdentityMatrixCaller
  sessionId: string
  regions: Region[]
  signal: AbortSignal
  statusCallback: (status: RpcStatus) => void
}) {
  const { clusterableSources: sources, adapterConfig } = model
  const byteLimit = model.resolvedByteLimit()
  await applyClusterRun({
    model,
    rows: sources,
    // The locus is the whole provenance: the bin count is fixed and every row
    // of the window is scored.
    provenance: clusterProvenanceFromRegions(regions),
    matrix: () =>
      rpcManager.call(sessionId, 'LinearMafClusterIdentityMatrix', {
        regions,
        sources: sources.map(s => s.name),
        adapterConfig,
        byteLimit,
        signal,
        statusCallback,
      }),
  })
}
