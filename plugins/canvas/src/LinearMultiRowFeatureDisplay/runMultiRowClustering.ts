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
  effectiveRowsField: string
  // Resolved likewise: `auto` names no attribute the worker could read.
  effectiveClusterField: string
}

export interface MultiRowClusterDialogModel
  extends IStateTreeNode, MultiRowClusterModel {
  clusterCandidates: string[]
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
        model.effectiveRowsField,
        model.effectiveClusterField,
      ] as const)
    : null
}

// The matrix the R export downloads is the one the clustering ran on.
export function featureMatrixArgs(model: MultiRowClusterModel) {
  return {
    sources: model.clusterableSources.map(s => s.name),
    adapterConfig: model.adapterConfig,
    rowsField: model.effectiveRowsField,
    clusterField: model.effectiveClusterField,
    partition: model.clusterPartition,
  }
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
  const { clusterableSources, effectiveRowsField, effectiveClusterField } =
    model
  const result = await rpcManager.call(sessionId, 'MultiRowClusterFeatures', {
    ...featureMatrixArgs(model),
    regions,
    signal,
    statusCallback,
  })
  await applyClusterRun({
    model,
    rows: clusterableSources,
    // Both fields are the matrix, not a display preference, so the caption has
    // to say which pair produced a given tree.
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: effectiveRowsField },
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
