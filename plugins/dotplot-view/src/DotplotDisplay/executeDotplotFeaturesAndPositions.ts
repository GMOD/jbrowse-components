import { parseCigar2 } from '@jbrowse/alignments-core'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { dedupe } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'

// Float64 because cumBp values reach Gbp-scale, which Float32 can't represent
// without losing per-base precision. Hi/lo splitting happens at the GPU upload
// boundary only — never in plain JS, per project rules.
export interface DotplotFeaturesAndPositionsResult {
  p11: Float64Array
  p12: Float64Array
  p21: Float64Array
  p22: Float64Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  meanIdentities: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  mateRefNames: string[]
  parsedCigars: number[][]
  totalFeatureCount: number
  skippedFeatureCount: number
}

interface FeatureMate {
  start: number
  end: number
  refName: string
  assemblyName?: string
}

export async function executeDotplotFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  hViewSnap,
  vViewSnap,
  stopToken,
  lodMode,
  statusCallback,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  hViewSnap: BpIndexViewSnap
  vViewSnap: BpIndexViewSnap
  stopToken?: StopToken
  lodMode?: BaseOptions['lodMode']
  statusCallback?: StatusCallback
}) {
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const rawFeatures = await dataAdapter.getFeaturesInMultipleRegionsArray(
    regions,
    {
      stopToken,
      bpPerPx: hViewSnap.bpPerPx,
      lodMode,
      statusCallback,
    },
  )
  const features = dedupe(rawFeatures, f => f.id())

  // RefName aliases are resolved on the main thread before the RPC (the worker
  // has no assemblyManager), so hViewSnap/vViewSnap and the feature refNames are
  // already in the adapter's namespace and line up directly. See
  // DotplotDisplay/afterAttach.ts.
  const hIndex = buildBpRegionIndex(hViewSnap)
  const vIndex = buildBpRegionIndex(vViewSnap)

  // Single pass into over-allocated typed arrays (upper-bounded by the deduped
  // feature count), then subarray(0, n) to the valid count. Skipped features
  // (unmapped refName or unmappable position) leave no dead slots because the
  // write cursor only advances on a valid feature. The subarray'd buffers are
  // transferred whole — a zero-copy ownership move, so the trailing slack costs
  // nothing at the RPC boundary. refNames/mateRefNames/parsedCigars are pushed
  // (structured-cloned, not transferred) so they stay exactly n long.
  const count = features.length
  const p11 = new Float64Array(count)
  const p12 = new Float64Array(count)
  const p21 = new Float64Array(count)
  const p22 = new Float64Array(count)
  const strands = new Int8Array(count)
  const starts = new Uint32Array(count)
  const ends = new Uint32Array(count)
  const identities = new Float32Array(count)
  const meanIdentities = new Float32Array(count)
  const mappingQuals = new Float32Array(count)
  const refNames: string[] = []
  const mateRefNames: string[] = []
  const parsedCigars: number[][] = []

  let n = 0
  let skippedFeatureCount = 0
  for (const f of features) {
    // A comparative feature without a mate has no vertical-axis location to
    // plot, so skip it — mirrors extractAlignmentData's contract, and avoids
    // dereferencing an undefined mate below.
    const mate = f.get('mate') as FeatureMate | undefined
    if (!mate) {
      skippedFeatureCount++
      continue
    }
    const strand = f.get('strand') ?? 1
    const refName = f.get('refName')
    const mateRefName = mate.refName

    if (!hIndex.entries.has(refName) || !vIndex.entries.has(mateRefName)) {
      skippedFeatureCount++
      continue
    }

    const start = f.get('start')
    const end = f.get('end')
    // Reversed strand: swap start/end on the H axis so p11→p12 is a left→right
    // walk on screen regardless of strand.
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end

    const c11 = bpToCumBp(hIndex, refName, f1s)
    const c12 = bpToCumBp(hIndex, refName, f1e)
    const c21 = bpToCumBp(vIndex, mateRefName, mate.start)
    const c22 = bpToCumBp(vIndex, mateRefName, mate.end)
    if (
      c11 === undefined ||
      c12 === undefined ||
      c21 === undefined ||
      c22 === undefined
    ) {
      skippedFeatureCount++
      continue
    }

    p11[n] = c11
    p12[n] = c12
    p21[n] = c21
    p22[n] = c22
    strands[n] = strand
    starts[n] = start
    ends[n] = end
    identities[n] = (f.get('identity') as number | undefined) ?? -1
    meanIdentities[n] = (f.get('meanIdentity') as number | undefined) ?? -1
    mappingQuals[n] = (f.get('mappingQual') as number | undefined) ?? -1
    refNames.push(refName)
    mateRefNames.push(mateRefName)
    parsedCigars.push(parseCigar2((f.get('CIGAR') as string | undefined) ?? ''))
    n++
  }

  const result: DotplotFeaturesAndPositionsResult = {
    p11: p11.subarray(0, n),
    p12: p12.subarray(0, n),
    p21: p21.subarray(0, n),
    p22: p22.subarray(0, n),
    strands: strands.subarray(0, n),
    starts: starts.subarray(0, n),
    ends: ends.subarray(0, n),
    identities: identities.subarray(0, n),
    meanIdentities: meanIdentities.subarray(0, n),
    mappingQuals: mappingQuals.subarray(0, n),
    refNames,
    mateRefNames,
    parsedCigars,
    totalFeatureCount: count,
    skippedFeatureCount,
  }

  return rpcResult(result, [
    result.p11.buffer,
    result.p12.buffer,
    result.p21.buffer,
    result.p22.buffer,
    result.strands.buffer,
    result.starts.buffer,
    result.ends.buffer,
    result.identities.buffer,
    result.meanIdentities.buffer,
    result.mappingQuals.buffer,
  ])
}
