import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from './rowSources.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ClusterRunModel,
  RpcMethodCaller,
  TreeLayoutModel,
} from '@jbrowse/tree-sidebar'

type MultiRowClusterCaller = RpcMethodCaller<'MultiRowClusterFeatures'>

export interface MultiRowClusterModel extends ClusterRunModel<MultiRowSource> {
  clusterableSources: MultiRowSource[]
  adapterConfig: Record<string, unknown>
  // The resolved field, never the raw slot: the matrix has to bucket each
  // feature into the row the painting drew it in.
  effectivePartitionField: string
  colorConfig: string | undefined
}

export interface MultiRowClusterDialogModel
  extends
    IStateTreeNode,
    MultiRowClusterModel,
    Pick<TreeLayoutModel<MultiRowSource>, 'setLayout'> {}

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
        model.colorConfig,
      ] as const)
    : null
}

export async function runMultiRowClustering({
  model,
  regions,
  rpcManager,
  sessionId,
  stopToken,
  statusCallback,
}: {
  model: MultiRowClusterModel
  regions: Region[]
  rpcManager: MultiRowClusterCaller
  sessionId: string
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const {
    clusterableSources,
    adapterConfig,
    effectivePartitionField,
    colorConfig,
  } = model
  await applyClusterRun({
    model,
    rows: clusterableSources,
    // This display clusters on the rendered color of each bin, so the color
    // scheme is not a display preference here — it is the matrix, and the
    // caption has to say which coloring produced a given tree.
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: effectivePartitionField },
      ...(colorConfig ? [{ name: 'color', value: colorConfig }] : []),
    ]),
    matrix: () =>
      rpcManager.call(sessionId, 'MultiRowClusterFeatures', {
        regions,
        sources: clusterableSources.map(s => s.name),
        adapterConfig,
        partitionField: effectivePartitionField,
        colorConfig,
        stopToken,
        statusCallback,
      }),
  })
}
