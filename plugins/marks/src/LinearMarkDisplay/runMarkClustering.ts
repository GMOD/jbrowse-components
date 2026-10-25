import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MarkRowMatrixArgs } from '../MarkRowsRPC/rpcTypes.ts'
import type { RowCompare } from './rowCompare.ts'
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
  rowCompare: RowCompare | undefined
  rowCompareLabel: string
  layerRequests: LayerRequest[]
  host: { bpPerPx: number }
  rpcProps: () => { transform: TransformStep[]; facet?: FacetSpec }
  adapterOptions: object | undefined
  resolveAdapterOptions: (
    options: object,
    region: Region,
    signal: AbortSignal,
  ) => Promise<object | undefined>
}

export interface MarkClusterDialogModel
  extends IStateTreeNode, MarkClusterModel {}

/**
 * The matrix request: the display's own split, steps and adapter options over
 * `regions`, and the mark `rowCompare` names with what it compares, one
 * matrix row per row clustered.
 */
export async function markRowMatrixArgs(
  model: MarkClusterModel,
  regions: Region[],
  signal: AbortSignal,
): Promise<MarkRowMatrixArgs> {
  const { transform, facet } = model.rpcProps()
  const options = model.adapterOptions
  const { rowCompare } = model
  const layer = rowCompare && model.layerRequests[rowCompare.mark]
  if (!facet || !layer) {
    throw new Error(
      'Clustering compares the rows of a bar, point or rect mark, and none draws at this zoom',
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
    compare: rowCompare.by,
    ...(options
      ? {
          regionOpts: await Promise.all(
            regions.map(region =>
              model.resolveAdapterOptions(options, region, signal),
            ),
          ),
        }
      : {}),
  }
}

/** The dialog's fetch key: the run's inputs, never the model node. */
export function rowMatrixKey(model: MarkClusterModel) {
  const { clusterableSources, rowCompare } = model
  return clusterableSources.length && rowCompare
    ? ([
        'markRowMatrix',
        clusterableSources.map(row => row.name).join('\t'),
        JSON.stringify(model.rpcProps()),
        rowCompare.mark,
        rowCompare.by,
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
  const args = await markRowMatrixArgs(model, regions, signal)
  await applyClusterRun({
    model,
    rows: model.clusterableSources,
    provenance: clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: model.rowsField },
      args.compare === 'y'
        ? { name: 'y', value: String(args.layer.encoding.y ?? '') }
        : { name: 'compared on', value: model.rowCompareLabel },
    ]),
    matrix: () =>
      rpcManager.call(sessionId, 'MarkClusterRows', {
        ...args,
        signal,
        statusCallback,
      }),
  })
}
