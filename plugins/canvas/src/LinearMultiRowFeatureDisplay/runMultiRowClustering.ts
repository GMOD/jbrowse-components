import {
  clusteredCladeLayout,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from './rowSources.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ClusterProvenance,
  RpcMethodCaller,
  TreeLayoutModel,
} from '@jbrowse/tree-sidebar'

type MultiRowClusterCaller = RpcMethodCaller<'MultiRowClusterFeatures'>

// The subset of the display model this run reads/writes. Kept structural so the
// menu trigger and the declarative autorun call one shared implementation.
export interface MultiRowClusterModel {
  // The rows a run clusters — the focused clade, undecorated. See the model's
  // `clusterableSources`, and `clusteredCladeLayout` for why not `sources`.
  clusterableSources: MultiRowSource[]
  editableSources: MultiRowSource[]
  layout: readonly MultiRowSource[]
  adapterConfig: Record<string, unknown>
  // the resolved one, never the raw slot — the matrix has to bucket each
  // feature into the row the painting drew it in
  effectivePartitionField: string
  colorConfig: string | undefined
  setLayoutAndClusterTree: (
    layout: MultiRowSource[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}

/**
 * What the cluster dialog is handed: the run's own contract plus the write that
 * commits a pasted order, and the node the dialog resolves its view and RPC
 * manager off.
 *
 * `setLayout` is `Pick`ed off `TreeLayoutModel` rather than restated, so the
 * one declaration of it in this chain is the one the arrangement dialog and the
 * track menu's `self` already satisfy — the dialog's props used to spell out an
 * intersection of its own, free to drift from the type actually checking the
 * call site.
 */
export interface MultiRowClusterDialogModel
  extends
    IStateTreeNode,
    MultiRowClusterModel,
    Pick<TreeLayoutModel<MultiRowSource>, 'setLayout'> {}

/**
 * The cluster dialog's fetch key for the exported feature matrix: the run
 * arguments that decide what comes back, and nothing else.
 *
 * `useFetch` serializes its key on every render, and the key used to be the MST
 * display node — which stringifies to the whole display snapshot, `layout`
 * included, so a cohort's worth of rows was serialized per render and any
 * unrelated slot write re-keyed the fetch and re-ran the worker. The dialog
 * adds the region and the zoom itself.
 *
 * `null` when no row has been discovered: there is nothing to export yet.
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
  // The regions the matrix is built over, resolved by the caller: the autorun
  // hands them down (a `clusterRegion` locus, or the visible blocks) and the
  // dialog passes the visible blocks, so neither re-resolves them here.
  regions: Region[]
  rpcManager: MultiRowClusterCaller
  sessionId: string
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const { clusterableSources } = model
  const ret = await rpcManager.call(sessionId, 'MultiRowClusterFeatures', {
    regions,
    sources: clusterableSources.map(s => s.name),
    adapterConfig: model.adapterConfig,
    partitionField: model.effectivePartitionField,
    colorConfig: model.colorConfig,
    stopToken,
    statusCallback,
  })
  model.setLayoutAndClusterTree(
    clusteredCladeLayout({
      rows: clusterableSources,
      editableSources: model.editableSources,
      layout: model.layout,
      order: ret.order,
    }),
    ret.tree,
    // This display clusters on the *rendered color* of each bin, so the color
    // scheme is not a display preference here — it is the matrix. Change "Color
    // by…" and the same rows over the same locus give a different tree, which
    // is only defensible if the caption says which coloring produced this one.
    clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: model.effectivePartitionField },
      ...(model.colorConfig
        ? [{ name: 'color', value: model.colorConfig }]
        : []),
    ]),
  )
}
