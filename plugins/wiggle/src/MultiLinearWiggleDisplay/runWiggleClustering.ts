import { buildClusteredLayout } from '@jbrowse/tree-sidebar'

import { clusterScoreMatrixArgs } from './components/WiggleClusterDialog/clusterOptions.ts'

import type { ReducedModel } from './components/WiggleClusterDialog/types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { RpcMethodCaller } from '@jbrowse/tree-sidebar'

type ClusterScoreMatrixCaller = RpcMethodCaller<'MultiWiggleClusterScoreMatrix'>

// The real "Cluster columns" -> "Run clustering" RPC, extracted so it has one
// home: the dialog button and a declarative session-triggered run
// (getWiggleClusterAutorun) call the exact same code rather than two copies
// drifting apart.
export async function runWiggleClustering({
  model,
  rpcManager,
  sessionId,
  samplesPerPixel,
  stopToken,
  statusCallback,
}: {
  model: ReducedModel
  rpcManager: ClusterScoreMatrixCaller
  sessionId: string
  samplesPerPixel: string
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const { sourcesWithoutLayout } = model
  if (sourcesWithoutLayout.length) {
    const ret = await rpcManager.call(
      sessionId,
      'MultiWiggleClusterScoreMatrix',
      {
        ...clusterScoreMatrixArgs(model, samplesPerPixel),
        stopToken,
        statusCallback,
      },
    )
    model.setLayoutAndClusterTree(
      buildClusteredLayout(sourcesWithoutLayout, model.layout, ret.order),
      ret.tree,
    )
  }
}
