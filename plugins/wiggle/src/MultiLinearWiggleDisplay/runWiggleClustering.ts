import {
  buildClusteredLayout,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import { clusterScoreMatrixArgs } from './components/clusterOptions.ts'
import { parseSamplesPerPixel } from './components/parseSamplesPerPixel.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { RpcMethodCaller } from '@jbrowse/tree-sidebar'

type ClusterScoreMatrixCaller = RpcMethodCaller<'MultiWiggleClusterScoreMatrix'>

// The real "Cluster columns" -> "Run clustering" RPC, extracted so it has one
// home: the dialog button and a declarative session-triggered run (the
// `setupRunClusteringAutorun` install in the display's afterAttach) call the
// exact same code rather than two copies drifting apart.
export async function runWiggleClustering({
  model,
  rpcManager,
  sessionId,
  samplesPerPixel,
  regions,
  stopToken,
  statusCallback,
}: {
  model: ReducedModel
  rpcManager: ClusterScoreMatrixCaller
  sessionId: string
  samplesPerPixel: string
  // The `clusterRegion` locus, when a session named one; the dialog passes
  // nothing and gets the visible blocks
  regions?: Region[]
  stopToken: StopToken
  statusCallback: (status: RpcStatus) => void
}) {
  const { sourcesWithoutLayout } = model
  if (sourcesWithoutLayout.length) {
    const args = clusterScoreMatrixArgs(model, samplesPerPixel, regions)
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
      // a different set of measurements. The parsed value, not the raw field
      // text: `samplesPerPixel` is free text and the matrix was binned at what
      // `parseSamplesPerPixel` clamped or defaulted it to, so recording the
      // text would caption the matrix with a density it was never built at.
      clusterProvenanceFromRegions(args.regions, [
        {
          name: 'samples/px',
          value: String(parseSamplesPerPixel(samplesPerPixel)),
        },
      ]),
    )
  }
}
