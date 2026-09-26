import {
  applyClusterRun,
  clusterProvenanceFromRegions,
} from '@jbrowse/tree-sidebar'

import { clusterScoreMatrixArgs } from './components/clusterOptions.ts'
import { parseSamplesPerPixel } from './components/parseSamplesPerPixel.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { RpcMethodCaller } from '@jbrowse/tree-sidebar'

type ClusterScoreMatrixCaller = RpcMethodCaller<'MultiWiggleClusterScoreMatrix'>

// The one clustering run, for the dialog's button and a session's declarative
// `runClustering` alike.
export async function runWiggleClustering({
  model,
  rpcManager,
  sessionId,
  samplesPerPixel,
  regions,
  signal,
  statusCallback,
}: {
  model: ReducedModel
  rpcManager: ClusterScoreMatrixCaller
  sessionId: string
  samplesPerPixel: string
  // The `clusterRegion` locus when a session named one, the visible blocks when
  // the dialog ran it — resolved by whichever entry point called, never here
  regions: Region[]
  signal: AbortSignal
  statusCallback: (status: RpcStatus) => void
}) {
  const args = clusterScoreMatrixArgs(model, samplesPerPixel, regions)
  await applyClusterRun({
    model,
    rows: args.sources,
    // Sampling density belongs in the caption because it changes the matrix:
    // the columns are pixel bins, so the same locus at a different density is
    // a different set of measurements. The parsed value, not the raw field
    // text: `samplesPerPixel` is free text and the matrix was binned at what
    // `parseSamplesPerPixel` clamped or defaulted it to, so recording the
    // text would caption the matrix with a density it was never built at.
    provenance: clusterProvenanceFromRegions(args.regions, [
      {
        name: 'samples/px',
        value: String(parseSamplesPerPixel(samplesPerPixel)),
      },
    ]),
    matrix: () =>
      rpcManager.call(sessionId, 'MultiWiggleClusterScoreMatrix', {
        ...args,
        signal,
        statusCallback,
      }),
  })
}
