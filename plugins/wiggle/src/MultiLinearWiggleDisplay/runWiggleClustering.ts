import {
  buildClusteredLayout,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import { clusterScoreMatrixArgs } from './components/clusterOptions.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
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
    const args = clusterScoreMatrixArgs(model, samplesPerPixel)
    const ret = await rpcManager.call(
      sessionId,
      'MultiWiggleClusterScoreMatrix',
      {
        ...args,
        stopToken,
        statusCallback,
      },
    )
    model.setLayoutAndClusterTree(
      buildClusteredLayout(sourcesWithoutLayout, model.layout, ret.order),
      ret.tree,
      // Sampling density belongs in the caption because it changes the matrix:
      // the columns are pixel bins, so the same locus at a different density is
      // a different set of measurements. Taken from `args` rather than
      // recomputed so the recorded value cannot drift from the one sent.
      clusterProvenanceFromRegions(args.regions, [
        { name: 'samples/px', value: samplesPerPixel },
      ]),
    )
  }
}
