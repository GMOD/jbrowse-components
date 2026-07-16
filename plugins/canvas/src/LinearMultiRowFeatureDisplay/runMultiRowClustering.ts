import { buildClusteredLayout } from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from './sourcesLogic.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { RpcMethodCaller } from '@jbrowse/tree-sidebar'

type MultiRowClusterCaller = RpcMethodCaller<'MultiRowClusterFeatures'>

// The subset of the display model this run reads/writes. Kept structural so the
// menu trigger and the declarative autorun call one shared implementation.
export interface MultiRowClusterModel {
  sourcesWithoutLayout: MultiRowSource[]
  layout: MultiRowSource[]
  adapterConfig: Record<string, unknown>
  partitionField: string
  colorConfig: string | undefined
  setLayoutAndClusterTree: (layout: MultiRowSource[], tree?: string) => void
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
  const ret = await rpcManager.call(sessionId, 'MultiRowClusterFeatures', {
    regions: view.dynamicBlocks.contentBlocks,
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
  )
}
