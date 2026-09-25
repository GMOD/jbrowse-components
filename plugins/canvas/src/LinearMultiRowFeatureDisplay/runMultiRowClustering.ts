import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MatrixEncoding } from '../MultiRowClusterFeaturesRPC/buildMultiRowMatrix.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ClusterRunModel,
  RowSource,
  RpcMethodCaller,
} from '@jbrowse/tree-sidebar'

type MultiRowClusterCaller = RpcMethodCaller<'MultiRowClusterFeatures'>

export interface MultiRowClusterModel extends ClusterRunModel<RowSource> {
  clusterableSources: RowSource[]
  clusterPartition?: string[][]
  adapterConfig: Record<string, unknown>
  // The resolved field, never the raw slot: the matrix has to bucket each
  // feature into the row the painting drew it in.
  effectivePartitionField: string
  // Resolved likewise: `auto` names no attribute the worker could read.
  effectiveClusterField: string
}

export interface MultiRowClusterDialogModel
  extends IStateTreeNode, MultiRowClusterModel {
  partitionCandidates: string[]
  setClusterField: (field: string) => void
}

/**
 * `useFetch` serializes its key on every render, so this names only the run
 * arguments — handing it the MST display node would serialize a cohort's worth
 * of rows per render and re-key the fetch on any unrelated slot write.
 */
export function featureMatrixKey(model: MultiRowClusterModel) {
  const { clusterableSources } = model
  return clusterableSources.length
    ? ([
        'featureMatrix',
        clusterableSources.map(s => s.name).join('\t'),
        model.effectivePartitionField,
        model.effectiveClusterField,
      ] as const)
    : null
}

export async function runMultiRowClustering({
  model,
  regions,
  rpcManager,
  sessionId,
  signal,
  statusCallback,
}: {
  model: MultiRowClusterModel
  regions: Region[]
  rpcManager: MultiRowClusterCaller
  sessionId: string
  signal: AbortSignal
  statusCallback: (status: RpcStatus) => void
}) {
  const {
    clusterableSources,
    adapterConfig,
    effectivePartitionField,
    effectiveClusterField,
  } = model
  const result = await rpcManager.call(sessionId, 'MultiRowClusterFeatures', {
    regions,
    sources: clusterableSources.map(s => s.name),
    adapterConfig,
    partitionField: effectivePartitionField,
    clusterField: effectiveClusterField,
    partition: model.clusterPartition,
    signal,
    statusCallback,
  })
  await applyClusterRun({
    model,
    rows: clusterableSources,
    // Both fields are the matrix, not a display preference, so the caption has
    // to say which pair produced a given tree.
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: effectivePartitionField },
      {
        name: 'field',
        value: clusterFieldLabel(effectiveClusterField, result.encoding),
      },
    ]),
    matrix: async () => result,
  })
}

function clusterFieldLabel(clusterField: string, encoding: MatrixEncoding) {
  return clusterField === ''
    ? 'presence'
    : encoding === 'presence'
      ? `${clusterField} (too many values; clustered on presence)`
      : clusterField
}
