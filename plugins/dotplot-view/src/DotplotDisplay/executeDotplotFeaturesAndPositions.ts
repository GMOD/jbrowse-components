import { parseCigar2Typed } from '@jbrowse/alignments-core'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, dedupe } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'

import { cigarWorthParsing } from './dotplotCigarDetail.ts'

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
  // Reference-span length per feature, which is all the main thread needs (the
  // minAlignmentLength filter in buildLineSegments). Shipping start+end and
  // subtracting there sent two arrays for one derived number; same field and
  // same name LinearSyntenyDisplay's geometry already uses.
  alignmentLengths: Uint32Array
  identities: Float32Array
  meanIdentities: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  mateRefNames: string[]
  // Every feature's packed CIGAR ops concatenated into one transferable buffer,
  // with cigarOffsets[i]..cigarOffsets[i+1] delimiting feature i (length n+1).
  // An array-of-arrays would be structured-cloned per feature — the one thing on
  // this payload that isn't a zero-copy transfer — and CIGAR data dwarfs
  // everything else here. Empty slice = no CIGAR detail was worth shipping at
  // this zoom (see dotplotCigarDetail).
  cigarData: Uint32Array
  cigarOffsets: Uint32Array
  totalFeatureCount: number
  skippedFeatureCount: number
  // Distinct refNames a skipped feature named that the corresponding axis does
  // not index. The worker only knows what each axis DISPLAYS, so it cannot tell
  // "this name isn't in the assembly" (a real misconfiguration) from "this name
  // is in the assembly but the axis was restricted to a subset of it" — a
  // deliberate, supported state (per-axis `displayedRegionNames`). It reports
  // the names instead and lets the main thread, which has the assemblyManager,
  // make that call. Distinct, so this is bounded by scaffold count, not feature
  // count.
  skippedHRefNames: string[]
  skippedVRefNames: string[]
}

// Shared empty slice for features whose CIGAR isn't worth parsing, so the
// no-detail path allocates nothing.
const EMPTY_CIGAR = new Uint32Array(0)

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
      // The assembly on the vertical axis. A multi-genome adapter
      // (MCScanBlocksAdapter, AllVsAllPAFAdapter) draws N-1 pairs from one
      // track, so the fetch must name which pair this dotplot is — otherwise
      // the adapter defaults the mate to the first *other* assembly in
      // assemblyNames and returns another pair's alignments, whose refNames
      // match no vViewSnap region, leaving an empty plot behind the
      // "could not be mapped" warning. Mirrors the synteny render path's
      // `targetAssemblyName: v2.displayedRegions[0]?.assemblyName`; renaming
      // rewrites refName but not assemblyName, so this stays canonical.
      targetAssemblyName: vViewSnap.displayedRegions[0]?.assemblyName,
    },
  )
  // Give the synchronous prepare/projection work its own labels. Without them
  // the bar held whatever the fetch phase last wrote for the entire CPU pass —
  // seconds on a whole-genome PAF — which reads as a stuck bar. Mirrors the
  // synteny worker's three phases.
  statusCallback?.('Preparing dotplot features')
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
  // nothing at the RPC boundary. refNames/mateRefNames are pushed
  // (structured-cloned, not transferred) so they stay exactly n long; CIGARs are
  // collected per feature then concatenated into one transferable pair below.
  const count = features.length
  const p11 = new Float64Array(count)
  const p12 = new Float64Array(count)
  const p21 = new Float64Array(count)
  const p22 = new Float64Array(count)
  const strands = new Int8Array(count)
  const alignmentLengths = new Uint32Array(count)
  const identities = new Float32Array(count)
  const meanIdentities = new Float32Array(count)
  const mappingQuals = new Float32Array(count)
  const refNames: string[] = []
  const mateRefNames: string[] = []
  const cigarChunks: Uint32Array[] = []
  let cigarTotal = 0

  let n = 0
  let skippedFeatureCount = 0
  const skippedHRefNames = new Set<string>()
  const skippedVRefNames = new Set<string>()
  // report() runs the throttled stop-token check as well as advancing the bar,
  // so cancelling a whole-genome projection lands mid-loop instead of only at
  // the next phase boundary.
  const report = createProgressReporter({
    label: 'Computing dotplot positions',
    total: count,
    statusCallback,
    stopToken,
  })
  for (const f of features) {
    report()
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

    const hMissing = !hIndex.entries.has(refName)
    const vMissing = !vIndex.entries.has(mateRefName)
    if (hMissing || vMissing) {
      skippedFeatureCount++
      if (hMissing) {
        skippedHRefNames.add(refName)
      }
      if (vMissing) {
        skippedVRefNames.add(mateRefName)
      }
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
    alignmentLengths[n] = Math.abs(end - start)
    identities[n] = (f.get('identity') as number | undefined) ?? -1
    meanIdentities[n] = (f.get('meanIdentity') as number | undefined) ?? -1
    mappingQuals[n] = (f.get('mappingQual') as number | undefined) ?? -1
    refNames.push(refName)
    mateRefNames.push(mateRefName)
    // Parse only what the geometry builder could actually walk at this zoom. A
    // whole-genome PAF is mostly sub-pixel alignments whose parsed ops would be
    // built, shipped, and then ignored.
    const cigarStr = f.get('CIGAR') as string | undefined
    const cigar =
      cigarStr &&
      cigarWorthParsing(
        c12 - c11,
        c22 - c21,
        hViewSnap.bpPerPx,
        vViewSnap.bpPerPx,
      )
        ? parseCigar2Typed(cigarStr)
        : EMPTY_CIGAR
    cigarChunks.push(cigar)
    cigarTotal += cigar.length
    n++
  }

  // Concatenate into the flat (data, offsets) pair the result ships. Offsets are
  // n+1 long so feature i is always cigarData.subarray(off[i], off[i+1]).
  statusCallback?.('Packing CIGAR data')
  const cigarData = new Uint32Array(cigarTotal)
  const cigarOffsets = new Uint32Array(n + 1)
  let cigarWrite = 0
  for (let i = 0; i < n; i++) {
    const chunk = cigarChunks[i]!
    cigarData.set(chunk, cigarWrite)
    cigarWrite += chunk.length
    cigarOffsets[i + 1] = cigarWrite
  }

  const result: DotplotFeaturesAndPositionsResult = {
    p11: p11.subarray(0, n),
    p12: p12.subarray(0, n),
    p21: p21.subarray(0, n),
    p22: p22.subarray(0, n),
    strands: strands.subarray(0, n),
    alignmentLengths: alignmentLengths.subarray(0, n),
    identities: identities.subarray(0, n),
    meanIdentities: meanIdentities.subarray(0, n),
    mappingQuals: mappingQuals.subarray(0, n),
    refNames,
    mateRefNames,
    cigarData,
    cigarOffsets,
    totalFeatureCount: count,
    skippedFeatureCount,
    skippedHRefNames: [...skippedHRefNames],
    skippedVRefNames: [...skippedVRefNames],
  }

  return rpcResult(result, [
    result.p11.buffer,
    result.p12.buffer,
    result.p21.buffer,
    result.p22.buffer,
    result.strands.buffer,
    result.alignmentLengths.buffer,
    result.identities.buffer,
    result.meanIdentities.buffer,
    result.mappingQuals.buffer,
    result.cigarData.buffer,
    result.cigarOffsets.buffer,
  ])
}
