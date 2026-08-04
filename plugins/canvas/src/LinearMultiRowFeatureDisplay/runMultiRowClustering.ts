import {
  buildClusteredLayout,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from './sourcesLogic.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type {
  ClusterProvenance,
  RpcMethodCaller,
} from '@jbrowse/tree-sidebar'

type MultiRowClusterCaller = RpcMethodCaller<'MultiRowClusterFeatures'>

// The subset of the display model this run reads/writes. Kept structural so the
// menu trigger and the declarative autorun call one shared implementation.
export interface MultiRowClusterModel {
  sourcesWithoutLayout: MultiRowSource[]
  layout: MultiRowSource[]
  adapterConfig: Record<string, unknown>
  partitionField: string
  colorConfig: string | undefined
  setLayoutAndClusterTree: (
    layout: MultiRowSource[],
    tree?: string,
    provenance?: ClusterProvenance,
  ) => void
}

export async function runMultiRowClustering({
  model,
  view,
  rpcManager,
  sessionId,
  stopToken,
  statusCallback,
}: {
  model: MultiRowClusterModel
  // just the visible-regions the matrix is built over — the autorun's `run`
  // already hands us the view, so we don't re-resolve it via getContainingView
  view: { dynamicBlocks: { contentBlocks: Region[] } }
  rpcManager: MultiRowClusterCaller
  sessionId: string
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const { sourcesWithoutLayout } = model
  // one row can't be clustered; two-plus is required for a meaningful tree
  if (sourcesWithoutLayout.length < 2) {
    return
  }
  const regions = view.dynamicBlocks.contentBlocks
  const ret = await rpcManager.call(sessionId, 'MultiRowClusterFeatures', {
    regions,
    sources: sourcesWithoutLayout.map(s => s.name),
    adapterConfig: model.adapterConfig,
    partitionField: model.partitionField,
    colorConfig: model.colorConfig,
    stopToken,
    statusCallback,
  })
  model.setLayoutAndClusterTree(
    buildClusteredLayout(sourcesWithoutLayout, model.layout, ret.order),
    ret.tree,
    // This display clusters on the *rendered color* of each bin, so the color
    // scheme is not a display preference here — it is the matrix. Change "Color
    // by…" and the same rows over the same locus give a different tree, which
    // is only defensible if the caption says which coloring produced this one.
    clusterProvenanceFromRegions(regions, [
      { name: 'rows', value: model.partitionField },
      ...(model.colorConfig
        ? [{ name: 'color', value: model.colorConfig }]
        : []),
    ]),
  )
}
