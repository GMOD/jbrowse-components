import { buildClusteredLayout } from '@jbrowse/tree-sidebar'

import { clusterScoreMatrixArgs } from './components/WiggleClusterDialog/clusterOptions.ts'

import type { ReducedModel } from './components/WiggleClusterDialog/types.ts'
import type { RpcArgs, RpcReturn } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type ClusterMethod = 'MultiWiggleClusterScoreMatrix'

// Narrow structural slice of RpcManager — only the one method this function
// calls, typed straight off the RpcRegistry entry that
// MultiWiggleClusterScoreMatrix.ts registers (not a hand-duplicated shape, so
// it can't drift from the real RPC method). Kept separate from the real
// RpcManager class — which has private members — so a plain mock object can
// stand in for it in tests without an unsafe cast. Mirrors
// plugins/variants/src/shared/runGenotypeClustering.ts's
// ClusterGenotypeMatrixCaller.
export interface ClusterScoreMatrixCaller {
  call: (
    sessionId: string,
    functionName: ClusterMethod,
    args: Omit<RpcArgs<ClusterMethod>, 'sessionId'>,
  ) => Promise<RpcReturn<ClusterMethod>>
}

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
