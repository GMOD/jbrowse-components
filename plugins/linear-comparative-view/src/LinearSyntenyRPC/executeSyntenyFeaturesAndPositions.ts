import { parseCigar2Typed } from '@jbrowse/alignments-core'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  cmpStr,
  createProgressReporter,
  dedupe,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'

import {
  MIN_CIGAR_PX_WIDTH,
  buildSyntenyGeometry,
} from './buildSyntenyGeometry.ts'
import { clipLargeBlockToWindow } from './clipSyntenyFeature.ts'
import { syntenyPanBufferPx } from './syntenyFetchWindow.ts'

import type { SyntenyGeometry } from './buildSyntenyGeometry.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const EMPTY_CIGAR = new Uint32Array(0)

// Clip a CIGAR block to the viewport only when it is at least this many times
// wider than the visible window. A whole liftOver chain is 100-1000x; a normal
// alignment is <= 1x, so this leaves the well-trodden path untouched (only
// pathologically large blocks, which otherwise fail to render, are re-anchored).
const CLIP_SPAN_RATIO = 4

interface SyntenyMate {
  start: number
  end: number
  refName: string
  assemblyName: string
}

// Feature keys read once up front (in the decorate step) so the O(n log n) sort
// comparator and the projection loop never re-invoke the proxied Feature.get.
interface DecoratedFeature {
  f: Feature
  len: number
  refName: string
  start: number
  end: number
  strand: number
  mate: SyntenyMate
  mateRefName: string
  mateStart: number
  id: string
}

// Synteny-specific feature fields. Feature.get returns `unknown` for these
// non-standard keys, so the cast is centralized in one typed accessor rather
// than repeated (and previously diverging) at each call site.
function getMate(f: Feature) {
  return f.get('mate') as SyntenyMate
}
function getOptionalNumber(f: Feature, key: string) {
  return (f.get(key) as number | undefined) ?? -1
}

export interface SyntenyViewSnap {
  bpPerPx: number
  minimumBlockWidth: number
  width: number
  offsetPx: number
  // The whole concatenated genome, spanning the full cumBp coordinate axis.
  displayedRegions: Region[]
  // The visible window + pan buffer, clamped to displayedRegions. The indexed
  // fetch is scoped to this (a superset of the worker's cull window) so a
  // whole-genome PAF zoomed to one locus fetches only the on-screen slice.
  fetchRegions: Region[]
}

export interface SyntenyRpcResult extends SyntenyFeatureData {
  instanceData: SyntenyGeometry
}

export async function executeSyntenyFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  queryView,
  targetView,
  stopToken,
  drawCIGAR = true,
  drawCIGARMatchesOnly = false,
  drawLocationMarkers = false,
  lodMode,
  statusCallback,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  // The two adjacent genome views this synteny level connects. RefNames are
  // already in the adapter's namespace — refName aliasing is resolved on the
  // main thread (the RPC worker has no assemblyManager), so the cumBp index and
  // the feature refNames line up directly. See LinearSyntenyDisplay/afterAttach.
  queryView: SyntenyViewSnap
  targetView: SyntenyViewSnap
  stopToken?: StopToken
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
  drawLocationMarkers?: boolean
  lodMode?: BaseOptions['lodMode']
  statusCallback?: StatusCallback
}) {
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const v1 = queryView
  const v2 = targetView

  const bpPerPx = v1.bpPerPx
  // forward statusCallback so the adapter's determinate download + parse phases
  // drive the bar; the loading overlay shows a plain "Loading" label otherwise.
  // fetchRegions is the visible window + pan buffer (a superset of the cull
  // window below), so an indexed adapter downloads only the on-screen slice
  // while the cumBp index below still spans the whole displayedRegions.
  //
  // The query is on v1 (the query axis) only — as it always has been, when it
  // spanned the whole genome. Scoping it therefore drops one class the old
  // whole-genome fetch happened to include: an alignment whose query coords sit
  // outside this window but whose mate is on-screen in v2. That is inherent to a
  // single-axis fetch; a two-axis fetch can't dedupe q- against t-perspective
  // rows (PIF gives them distinct file offsets, hence distinct feature ids).
  const allFeatures = await dataAdapter.getFeaturesInMultipleRegionsArray(
    v1.fetchRegions,
    {
      stopToken,
      bpPerPx,
      lodMode,
      statusCallback,
      // the assembly on the other side of this band; a multi-genome adapter
      // (AllVsAllPAFAdapter) uses it to keep only this pair's records
      targetAssemblyName: v2.displayedRegions[0]?.assemblyName,
    },
  )
  // Build the cumBp region indexes first: their refName-keyed maps double as the
  // visible-refName sets, which let us discard features on refNames not shown in
  // BOTH views BEFORE the O(n log n) dedupe/decorate/sort. Whole-genome PAF
  // zoomed to one locus carries millions of off-screen features; filtering here
  // shrinks the sort input to the visible subset. Behavior-preserving — the
  // projection loop skipped these anyway (never incremented validCount), so the
  // featureId→index mapping is unchanged.
  const v1Index = buildBpRegionIndex(v1)
  const v2Index = buildBpRegionIndex(v2)
  const v1RefNames = v1Index.entries
  const v2RefNames = v2Index.entries

  // Give this synchronous prepare phase (dedupe + decorate + sort) its own
  // label; otherwise the loading overlay keeps whatever the fetch phase last
  // showed while a large PAF sorts, which reads as a stuck bar.
  statusCallback?.('Preparing synteny features')
  const deduped = dedupe(allFeatures, f => f.id())

  // Decorate with a deterministic total order so the worker's output never
  // depends on the adapter's block-arrival order (which varies run-to-run as
  // concurrent region fetches resolve). Length stays the primary key —
  // small→large so big ribbons land on top of sub-pixel noise in alpha-over
  // compositing (matches the standalone ribbon-plot script) — but ties break on
  // position/mate/id instead of arrival order. This stabilizes alpha compositing
  // of equal-length overlapping ribbons, the feature-index→featureId mapping
  // (click/hover identity), and downstream diagonalize. The decorated records
  // are also what the projection loop iterates, so refName/start/end/strand/mate
  // aren't re-fetched per feature.
  const decorated: DecoratedFeature[] = []
  for (const f of deduped) {
    const refName = f.get('refName')
    const mate = getMate(f)
    if (v1RefNames.has(refName) && v2RefNames.has(mate.refName)) {
      const start = f.get('start')
      const end = f.get('end')
      decorated.push({
        f,
        len: end - start,
        refName,
        start,
        end,
        strand: f.get('strand')!,
        mate,
        mateRefName: mate.refName,
        mateStart: mate.start,
        id: f.id(),
      })
    }
  }
  decorated.sort(
    (a, b) =>
      a.len - b.len ||
      cmpStr(a.refName, b.refName) ||
      a.start - b.start ||
      cmpStr(a.mateRefName, b.mateRefName) ||
      a.mateStart - b.mateStart ||
      cmpStr(a.id, b.id),
  )

  const count = decorated.length
  // cumBp (bpBefore + bpOffset, no padding) is whole-assembly cumulative-bp,
  // held in Float64 (exact to 2^53) — unbounded by uint32; a 16 Gbp assembly is
  // fine. See agent-docs/ARCHITECTURE.md "Genome-size limits".
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
  const strandsArray = new Int8Array(count)
  // These are chromosome-LOCAL feature/mate coords (not cumulative), so they
  // fit in uint32 as long as no single reference sequence exceeds 2^32 = 4.29
  // Gbp — an assumption we accept (see agent-docs/ARCHITECTURE.md "Genome-size
  // limits"). Used for the feature-detail panel and the min-length cull; the
  // drawn positions use the Float64 cumBp arrays above, not these.
  const startsArray = new Uint32Array(count)
  const endsArray = new Uint32Array(count)
  const mateStartsArray = new Uint32Array(count)
  const mateEndsArray = new Uint32Array(count)
  const identitiesArray = new Float32Array(count)
  const mappingQualsArray = new Float32Array(count)
  const meanIdentitiesArray = new Float32Array(count)

  const featureIds: string[] = []
  const names: string[] = []
  const refNames: string[] = []
  const assemblyNames: string[] = []
  const mateRefNames: string[] = []
  const mateAssemblyNames: string[] = []
  const parsedCigars: Uint32Array[] = []
  let hasCigar = false
  // Viewport culling: skip features entirely outside the visible area in
  // both views. A synteny parallelogram is visible when at least one of its
  // edges (top=view1, bottom=view2) overlaps the viewport.
  const viewWidth = v1.width
  const v1Offset = v1.offsetPx
  const v2Offset = v2.offsetPx
  const bpPerPxInv1 = 1 / v1.bpPerPx
  const bpPerPxInv2 = 1 / v2.bpPerPx
  // Shared with the main-thread fetch window (syntenyFetchRegions) and >= the
  // PAN_BUFFER_PX emit cull in buildSyntenyGeometry, so this whole-feature cull
  // never drops a feature the geometry stage would emit, and the scoped fetch
  // never omits a feature this cull would keep.
  const bufferPx = syntenyPanBufferPx(viewWidth)
  const offScreenLeftBound = -bufferPx
  const offScreenRightBound = viewWidth + bufferPx

  // Visible v1 window in whole-assembly cumBp (screenX 0..width, plus the pan
  // buffer). Used to re-anchor oversized CIGAR blocks; within one region cumBp
  // spans equal local-bp spans, so this drives both the size test and the
  // per-region local window below.
  const winCumLo = (v1Offset - bufferPx) * v1.bpPerPx
  const winCumHi = (v1Offset + viewWidth + bufferPx) * v1.bpPerPx
  const windowSpan = winCumHi - winCumLo

  const stopTokenChecker = createStopTokenChecker(stopToken)
  // report() runs the throttled stop-token check itself, so it replaces the
  // per-feature checkStopToken2 while also advancing the bar over whole-genome
  // PAF (potentially millions of features).
  const report = createProgressReporter({
    label: 'Computing synteny positions',
    total: count,
    statusCallback,
    stopTokenCheck: stopTokenChecker,
  })
  let validCount = 0
  for (const d of decorated) {
    report()
    const { f, id, refName, start, end, strand, mate, mateRefName } = d
    // Off-refName features (whole-genome PAF at low zoom) were already dropped
    // during decorate, so every record here projects into both views.

    const cigarStr = f.get('CIGAR') as string | undefined
    if (cigarStr) {
      hasCigar = true
    }

    // A single alignment block can be a whole liftOver chain (tens of Mb). Its
    // base ribbon is one linear trapezoid across that span, which cannot follow
    // megabases of indels, so at high zoom nothing renders. Re-anchor such a
    // block to just its visible slice (accurate coords + a short CIGAR); normal
    // blocks are left untouched. The detail panel + min-length cull still see
    // the original block extent (starts/ends below); only geometry is clipped.
    const clip = clipLargeBlockToWindow({
      v1Index,
      refName,
      start,
      end,
      mateStart: mate.start,
      mateEnd: mate.end,
      strand,
      cigar: cigarStr,
      winCumLo,
      winCumHi,
      windowSpan,
      spanRatio: CLIP_SPAN_RATIO,
    })
    const fStart = clip?.start ?? start
    const fEnd = clip?.end ?? end
    const mStart = clip?.mateStart ?? mate.start
    const mEnd = clip?.mateEnd ?? mate.end
    const clippedCigar = clip?.cigar

    const f1s = strand === -1 ? fEnd : fStart
    const f1e = strand === -1 ? fStart : fEnd

    const p11 = bpToCumBp(v1Index, refName, f1s)
    const p12 = bpToCumBp(v1Index, refName, f1e)
    const p21 = bpToCumBp(v2Index, mateRefName, mStart)
    const p22 = bpToCumBp(v2Index, mateRefName, mEnd)

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }

    // Cull features where BOTH view projections are entirely off-screen.
    // Convert cumBp to screen px for the check.
    const topMinX = Math.min(p11, p12) * bpPerPxInv1 - v1Offset
    const topMaxX = Math.max(p11, p12) * bpPerPxInv1 - v1Offset
    const botMinX = Math.min(p21, p22) * bpPerPxInv2 - v2Offset
    const botMaxX = Math.max(p21, p22) * bpPerPxInv2 - v2Offset

    const topOffScreen =
      topMaxX < offScreenLeftBound || topMinX > offScreenRightBound
    const botOffScreen =
      botMaxX < offScreenLeftBound || botMinX > offScreenRightBound

    if (topOffScreen && botOffScreen) {
      continue
    }

    p11Array[validCount] = p11
    p12Array[validCount] = p12
    p21Array[validCount] = p21
    p22Array[validCount] = p22
    strandsArray[validCount] = strand
    startsArray[validCount] = start
    endsArray[validCount] = end

    identitiesArray[validCount] = getOptionalNumber(f, 'identity')
    mappingQualsArray[validCount] = getOptionalNumber(f, 'mappingQual')
    meanIdentitiesArray[validCount] = getOptionalNumber(f, 'meanIdentity')

    mateStartsArray[validCount] = mate.start
    mateEndsArray[validCount] = mate.end

    featureIds.push(id)
    names.push(f.get('name') ?? '')
    refNames.push(refName)
    assemblyNames.push((f.get('assemblyName') as string | undefined) ?? '')
    mateRefNames.push(mateRefName)
    mateAssemblyNames.push(mate.assemblyName)
    // Only parse the CIGAR when it will actually be visited. Chromosome-scale
    // alignments can carry multi-megabyte CIGAR strings (~4 bytes/op in the
    // parsed Uint32Array, so tens of MB per feature). Gate matches the
    // willDrawCigar predicate in buildSyntenyGeometry via the shared
    // MIN_CIGAR_PX_WIDTH — drawCIGAR off or alignment narrower than that means
    // the visitor never fires, and addLocationMarkers operates on bp coords
    // without needing the CIGAR. A clipped block already carries its (short)
    // visible-slice CIGAR from the re-anchor above.
    const widthPx0 = topMaxX - topMinX
    const widthPx1 = botMaxX - botMinX
    const willNeedCigar =
      !!cigarStr &&
      drawCIGAR &&
      Math.max(widthPx0, widthPx1) >= MIN_CIGAR_PX_WIDTH
    parsedCigars.push(
      clippedCigar ??
        (willNeedCigar ? parseCigar2Typed(cigarStr) : EMPTY_CIGAR),
    )

    validCount++
  }

  // cumBp arrays are intermediate buffers consumed only by buildSyntenyGeometry
  // below. They never leave the worker — the main thread reads bp-space hi/lo
  // pairs out of `instanceData`.
  const p11_cumBp = p11Array.subarray(0, validCount)
  const p12_cumBp = p12Array.subarray(0, validCount)
  const p21_cumBp = p21Array.subarray(0, validCount)
  const p22_cumBp = p22Array.subarray(0, validCount)

  const featureData = {
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    mappingQuals: mappingQualsArray.subarray(0, validCount),
    meanIdentities: meanIdentitiesArray.subarray(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    mateStarts: mateStartsArray.subarray(0, validCount),
    mateEnds: mateEndsArray.subarray(0, validCount),
    mateRefNames,
    mateAssemblyNames,
    hasCigar,
  }

  // colorBy lives on the main thread; the worker emits geometry +
  // per-instance `kinds`/`instanceFeatureIdx` descriptors, and the display
  // model recomputes `colors` on colorBy change without an RPC round-trip.

  const instanceData = await updateStatus(
    'Computing synteny layout',
    statusCallback,
    () =>
      buildSyntenyGeometry({
        p11_cumBp,
        p12_cumBp,
        p21_cumBp,
        p22_cumBp,
        strands: featureData.strands,
        parsedCigars,
        starts: featureData.starts,
        ends: featureData.ends,
        drawCIGAR,
        drawCIGARMatchesOnly,
        drawLocationMarkers,
        bpPerPx0: v1.bpPerPx,
        bpPerPx1: v2.bpPerPx,
        viewOff0: v1.offsetPx,
        viewOff1: v2.offsetPx,
        viewWidth,
      }),
  )

  return rpcResult({ ...featureData, instanceData }, [
    featureData.strands.buffer,
    featureData.starts.buffer,
    featureData.ends.buffer,
    featureData.identities.buffer,
    featureData.mappingQuals.buffer,
    featureData.meanIdentities.buffer,
    featureData.mateStarts.buffer,
    featureData.mateEnds.buffer,
    instanceData.bp1.buffer,
    instanceData.bp2.buffer,
    instanceData.bp3.buffer,
    instanceData.bp4.buffer,
    instanceData.kinds.buffer,
    instanceData.instanceFeatureIdx.buffer,
    instanceData.alignmentLengths.buffer,
  ] as ArrayBuffer[])
}
