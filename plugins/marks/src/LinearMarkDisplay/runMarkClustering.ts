import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MarkRowMatrixArgs } from '../MarkRowsRPC/rpcTypes.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type {
  FacetSpec,
  LayerRequest,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ClusterRunModel,
  RowSource,
  RpcMethodCaller,
} from '@jbrowse/tree-sidebar'

export interface MarkClusterModel extends ClusterRunModel<RowSource> {
  clusterableSources: RowSource[]
  adapterConfig: Record<string, unknown>
  rowsField: string
  valueMarkIndex: number
  layerRequests: LayerRequest[]
  host: { bpPerPx: number }
  rpcProps: () => { transform: TransformStep[]; facet?: FacetSpec }
}

export interface MarkClusterDialogModel
  extends IStateTreeNode, MarkClusterModel {}

/**
 * The matrix request: the display's own split and steps over `regions`, and
 * the first mark standing at a value, one matrix row per row clustered.
 */
export function markRowMatrixArgs(
  model: MarkClusterModel,
  regions: Region[],
): MarkRowMatrixArgs {
  const { transform, facet } = model.rpcProps()
  const layer = model.layerRequests[model.valueMarkIndex]
  if (!facet || !layer) {
    throw new Error(
      'Clustering compares the values a bar or point mark stands at, and none draws at this zoom',
    )
  }
  return {
    adapterConfig: model.adapterConfig,
    regions,
    rows: model.clusterableSources.map(row => row.name),
    transform,
    facet,
    bpPerPx: model.host.bpPerPx,
    layer,
  }
}

/** The dialog's fetch key: the run's inputs, never the model node. */
export function rowMatrixKey(model: MarkClusterModel) {
  const { clusterableSources, valueMarkIndex } = model
  return clusterableSources.length && valueMarkIndex !== -1
    ? ([
        'markRowMatrix',
        clusterableSources.map(row => row.name).join('\t'),
        JSON.stringify(model.rpcProps()),
        valueMarkIndex,
      ] as const)
    : null
}

export async function runMarkClustering({
  model,
  regions,
  rpcManager,
  sessionId,
  signal,
  statusCallback,
}: {
  model: MarkClusterModel
  regions: Region[]
  rpcManager: RpcMethodCaller<'MarkClusterRows'>
  sessionId: string
  signal: AbortSignal
  statusCallback: (status: RpcStatus) => void
}) {
  const args = markRowMatrixArgs(model, regions)
  await applyClusterRun({
    model,
    rows: model.clusterableSources,
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: model.rowsField },
      { name: 'y', value: String(args.layer.encoding.y ?? '') },
    ]),
    matrix: () =>
      rpcManager.call(sessionId, 'MarkClusterRows', {
        ...args,
        signal,
        statusCallback,
      }),
  })
}
