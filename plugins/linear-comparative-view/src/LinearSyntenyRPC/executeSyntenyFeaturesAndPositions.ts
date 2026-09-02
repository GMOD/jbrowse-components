import { parseCigar2Typed, parseCoarseCigar } from '@jbrowse/cigar-utils'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  createProgressReporter,
  dedupe,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import {
  PRESET_ATTRIBUTES,
  buildBpRegionIndex,
  clampBlockToRegions,
  createAttributeChannels,
  cumBpAtGenomicCoord,
  cumBpInEntry,
  declaredAttributes,
  dnDsRatio,
  findRegionEntry,
  makeStringDict,
  readAttribute,
  syntenyPanBufferPx,
  writeAttribute,
} from '@jbrowse/synteny-core'

import { getMate } from '../syntenyMate.ts'
import {
  MIN_CIGAR_PX_WIDTH,
  RULER_GRID_ORIGIN,
  buildSyntenyGeometry,
} from './buildSyntenyGeometry.ts'
import {
  clipLargeBlockToWindow,
  clipSyntenyFeature,
} from './clipSyntenyFeature.ts'
import { createOffscreenMateCollector } from './collectOffscreenMates.ts'
import { flipSyntenyFeature } from './flipSyntenyFeature.ts'
import { compareDrawOrder, drawTier } from './syntenyDrawOrder.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyMate } from '../syntenyMate.ts'
import type { SyntenyGeometry } from './buildSyntenyGeometry.ts'
import type { DrawOrderKey } from './syntenyDrawOrder.ts'
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

// Feature keys read once up front (in the decorate step) so the O(n log n) sort
// comparator and the projection loop never re-invoke the proxied Feature.get.
// The sort keys are `DrawOrderKey`'s — `compareDrawOrder` is what reads them.
interface DecoratedFeature extends DrawOrderKey {
  f: Feature
  end: number
  strand: number
  mate: SyntenyMate
}

// Fields both axes supply: the cumBp index (bpPerPx + the whole concatenated
// genome, spanning the full cumBp axis) plus the viewport-start offset the cull
// converts against.
interface SyntenyViewSnapBase {
  bpPerPx: number
  offsetPx: number
  displayedRegions: Region[]
}

// The query axis (v1) drives the scoped indexed fetch and supplies the viewport
// width both views' culls size against (the two stacked LGVs share one width).
export interface SyntenyQueryViewSnap extends SyntenyViewSnapBase {
  width: number
  // The visible window + pan buffer, clamped to displayedRegions. The indexed
  // fetch is scoped to this (a superset of the worker's cull window) so a
  // whole-genome PAF zoomed to one locus fetches only the on-screen slice.
  fetchRegions: Region[]
}

// The target axis (v2). It always contributes its cumBp index and cull
// geometry; `fetchRegions` arrives only when the view asked for the second
// fetch, because carrying it unasked would ship dead bytes and pay a redundant
// refName rename per fetch. No `width` either way — the two stacked rows share
// one, and it comes off the query snap.
export interface SyntenyTargetViewSnap extends SyntenyViewSnapBase {
  fetchRegions?: Region[]
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
  queryView: SyntenyQueryViewSnap
  targetView: SyntenyTargetViewSnap
  stopToken?: StopToken
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
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

  // forward statusCallback so the adapter's determinate download + parse phases
  // drive the bar; the loading overlay shows a plain "Loading" label otherwise.
  // fetchRegions is the visible window + pan buffer (a superset of the cull
  // window below), so an indexed adapter downloads only the on-screen slice
  // while the cumBp index below still spans the whole displayedRegions.
  //
  // The query is on v1 (the query axis), which is what a synteny band has always
  // asked for. That leaves a whole class it cannot see AT ALL: an alignment
  // anchored on a v2 contig whose query end is somewhere v1 is not showing is
  // never requested, so nothing downstream can recover it. `v2.fetchRegions`
  // present is the view asking for that second half — see
  // agent-docs/ideas/two-axis-synteny-fetch.md, and `targetOffscreenMates`
  // below for what this pass does with the answer.
  //
  // IN PARALLEL, and only the query fetch drives the bar: the two would
  // otherwise fight over one determinate progress bar, and for the in-memory
  // adapters they share one `cachedSetup` download anyway, so the second
  // is a walk over records the first already parsed.
  const [allFeatures, targetAxisFeatures] = await Promise.all([
    dataAdapter.getFeaturesInMultipleRegionsArray(v1.fetchRegions, {
      stopToken,
      bpPerPx: v1.bpPerPx,
      lodMode,
      statusCallback,
      // the assembly on the other side of this band; a multi-genome adapter
      // (AllVsAllPAFAdapter) uses it to keep only this pair's records
      targetAssemblyName: v2.displayedRegions[0]?.assemblyName,
    }),
    // Anchored on v2, so the pair's OTHER assembly is v1's — and the regions
    // carry v2's own assemblyName, which is what tells a pairwise adapter which
    // side of the file to index (`PairwiseAdapterBase.facingSides`). Every pairwise
    // adapter answers from either side already, orienting the row it returns to
    // the axis asked about, so nothing here has to know which column the file
    // put this genome in.
    v2.fetchRegions
      ? dataAdapter.getFeaturesInMultipleRegionsArray(v2.fetchRegions, {
          stopToken,
          bpPerPx: v2.bpPerPx,
          lodMode,
          targetAssemblyName: v1.displayedRegions[0]?.assemblyName,
        })
      : undefined,
  ])
  // Build the cumBp region indexes first: their refName-keyed maps double as the
  // visible-refName sets, which let us discard features on refNames not shown in
  // BOTH views BEFORE the O(n log n) dedupe/decorate/sort. Whole-genome PAF
  // zoomed to one locus carries millions of off-screen features; filtering here
  // shrinks the sort input to the visible subset. Behavior-preserving — the
  // projection loop skipped these anyway (never incremented validCount), so the
  // featureId→index mapping is unchanged.
  //
  // The v2 half of that test still shrinks the sort input, but it no longer
  // DISCARDS what it drops: an alignment anchored in the visible v1 window whose
  // mate lands on a contig v2 is not displaying is fetched and decoded either
  // way, and it is not a rare edge — on demos/grape_peach_cacao, peach chr1
  // against grape chr1 draws 1029 of its 3796 anchors and the other 2767 (73%)
  // run to nine other grape contigs in clean paleopolyploid blocks. Those go to
  // `collectOffscreenMates` in the loop below, which is what lets the view say
  // so. The mirror of that class, anchored on v2, needs the second fetch above;
  // see `targetOffscreenMates`.
  const v1Index = buildBpRegionIndex(v1)
  const v2Index = buildBpRegionIndex(v2)
  const v1RefNames = v1Index.entries
  const v2RefNames = v2Index.entries

  // Give this synchronous prepare phase (dedupe + decorate + sort) its own
  // label; otherwise the loading overlay keeps whatever the fetch phase last
  // showed while a large PAF sorts, which reads as a stuck bar.
  statusCallback?.('Preparing synteny features')

  /**
   * What the second fetch found, split three ways by WHERE THE QUERY END LANDS.
   *
   * The adapter returns these anchored on the target row, which is the opposite
   * of what everything downstream assumes, so each class is decided from the
   * mate — the query end — and only the one that becomes a ribbon is turned
   * round.
   *
   * - inside the regions the FIRST fetch asked for → that fetch already
   *   returned it, drop. This is the whole of the dedupe between the two, and
   *   it needs no shared key: PIF and all-vs-all give one record's two
   *   perspectives unrelated ids on purpose, and a join that silently
   *   mismatches draws one ribbon twice at doubled alpha.
   * - on a query contig the row above IS displaying, outside that window → a
   *   real ribbon the query-axis fetch could not have seen, so it is flipped
   *   into the query perspective and joins the pile below. NOTHING DRAWS IT AT
   *   THE DEFAULT: its query end is at least a pan buffer off the edge by
   *   construction, and `isRibbonCulled` drops a ribbon when EITHER edge is
   *   outside `overdrawPx`, which defaults to less than that buffer. Raising
   *   the overdraw past the buffer is what reveals them, and what this fetch
   *   changes is that there is then something to reveal — see
   *   agent-docs/ideas/two-axis-synteny-fetch.md.
   * - on a contig the row above is not displaying at all → there is no second
   *   endpoint to run a ribbon to, so it is counted and marked on the target
   *   axis: the mirror of `offscreenMates` below.
   */
  const targetOffscreenMates = createOffscreenMateCollector(v2Index)
  const flippedRibbons: Feature[] = []
  if (targetAxisFeatures) {
    // the FETCHED window, not the displayed regions: what makes the two sets
    // disjoint is what the first fetch asked the adapter for
    const v1FetchedIndex = buildBpRegionIndex({
      bpPerPx: v1.bpPerPx,
      displayedRegions: v1.fetchRegions,
    })
    for (const f of dedupe(targetAxisFeatures, f => f.id())) {
      const refName = f.get('refName')
      const mate = getMate(f)
      if (!mate || !v2RefNames.has(refName)) {
        continue
      }
      const lo = Math.min(mate.start, mate.end)
      const hi = Math.max(mate.start, mate.end)
      if (!v1RefNames.has(mate.refName)) {
        targetOffscreenMates.add(
          refName,
          f.get('start'),
          f.get('end'),
          mate.refName,
          lo,
          hi,
        )
      } else if (!findRegionEntry(v1FetchedIndex, mate.refName, lo, hi)) {
        const flipped = flipSyntenyFeature(f)
        if (flipped) {
          flippedRibbons.push(flipped)
        }
      }
    }
  }

  const deduped = [...dedupe(allFeatures, f => f.id()), ...flippedRibbons]

  // Decorate with a deterministic total order so the worker's output never
  // depends on the adapter's block-arrival order — `compareDrawOrder` is the
  // paint order and, through the pick engine's backwards walk, the pick order
  // too. The decorated records are also what the projection loop iterates, so
  // refName/start/end/strand/mate aren't re-fetched per feature.
  const decorated: DecoratedFeature[] = []
  // The v2 half of the test above is not just a filter — see
  // `collectOffscreenMates`. Split out so what it drops can be counted and
  // placed on the query axis instead of vanishing.
  const offscreenMates = createOffscreenMateCollector(v1Index)
  for (const f of deduped) {
    const refName = f.get('refName')
    const mate = getMate(f)
    if (mate && v1RefNames.has(refName)) {
      const start = f.get('start')
      const end = f.get('end')
      // before the draw-order tier below, which is about how a ribbon stacks
      // against the others — this one gets no ribbon
      if (!v2RefNames.has(mate.refName)) {
        offscreenMates.add(
          refName,
          start,
          end,
          mate.refName,
          mate.start,
          mate.end,
        )
        continue
      }
      const px = Math.max(
        (end - start) / v1.bpPerPx,
        (mate.end - mate.start) / v2.bpPerPx,
      )
      decorated.push({
        f,
        px,
        tier: drawTier(px),
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
  decorated.sort(compareDrawOrder)

  const count = decorated.length
  // cumBp (bpBefore + bpOffset, no padding) is whole-assembly cumulative-bp,
  // held in Float64 (exact to 2^53) — unbounded by uint32; a 16 Gbp assembly is
  // fine. See agent-docs/reference/BP_PRECISION.md §"Genome-size limits".
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
  // Where the query axis's scalebar grid lands in cumBp, per feature, for the
  // location markers. Per feature because a view can show several regions of
  // the query assembly at once and each sits at its own offset into cumBp;
  // Float64 for the same reason the corners are.
  const queryGridAnchorArray = new Float64Array(count)
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
  // Every numeric channel a continuous mode can paint, keyed by name: the four
  // presets plus whatever the track declares. `identity` is in here too and
  // aliases identitiesArray below, so identity fade and the detail panel keep
  // their named field without a second copy or a second transfer.
  const channels = createAttributeChannels(
    [...PRESET_ATTRIBUTES, ...declaredAttributes(adapterConfig)],
    count,
  )

  // Distinct values per feature, so a dictionary would cost the same clone plus
  // an index array — see `makeStringDict` for where the line is.
  const featureIds: string[] = []
  // Five dictionary-encoded lanes: a name, a scaffold count, and (twice) the one
  // assembly this level draws. Ids are written into arrays sized `count` and
  // transferred; four of the dictionaries ride along as a few dozen strings.
  //
  // The NAME lane is the exception, and it is worth naming: a PAF puts nothing
  // there, but an MCScan or ortholog-table track puts a distinct gene id on
  // every feature, so its dictionary is as long as the fetch. That is the shape
  // `makeStringDict` says dictionary encoding is NOT worth — it costs the same
  // clone as a plain `string[]` plus a hash insert per feature, which is ~11% of
  // this worker's profile on a 14,599-feature grape/peach fetch. An append-only
  // lane for the high-cardinality case was prototyped and could not be shown to
  // beat this on a loaded box; it also breaks the `dict.indexOf(name)` reading
  // `stringDict.test.ts` pins. Left as it is on purpose, not by oversight.
  const nameIds = new Uint32Array(count)
  const refNameIds = new Uint32Array(count)
  const assemblyNameIds = new Uint32Array(count)
  const mateRefNameIds = new Uint32Array(count)
  const mateAssemblyNameIds = new Uint32Array(count)
  const nameDict = makeStringDict()
  const refNameDict = makeStringDict()
  const assemblyNameDict = makeStringDict()
  const mateRefNameDict = makeStringDict()
  const mateAssemblyNameDict = makeStringDict()
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
  // The one buffer all three windows use — the main-thread fetch window
  // (syntenyFetchRegions), this whole-feature cull, and the emit cull in
  // buildSyntenyGeometry — so this cull never drops a feature the geometry stage
  // would emit, and the scoped fetch never omits a feature this cull would keep.
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

  const channelList = channels.list
  const stopTokenChecker = createStopTokenChecker(stopToken)
  // report() runs the throttled stop-token check itself, so it replaces the
  // per-feature checkStopTokenThrottled while also advancing the bar over whole-genome
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
    // The coarse tier's fold of the CIGAR, walked in the CIGAR's place: runs
    // that each advance the two axes by their own lengths, and the gaps
    // make-pif kept. It counts for `hasCigar`, since every walk that flag
    // gates follows the fold as it follows a CIGAR (`getAlignmentOps`).
    const coarseTag = cigarStr ? undefined : f.get('coarseCigar')
    const coarseStr = typeof coarseTag === 'string' ? coarseTag : undefined
    if (cigarStr || coarseStr) {
      hasCigar = true
    }
    const parsedAlignment = () =>
      cigarStr
        ? parseCigar2Typed(cigarStr)
        : coarseStr
          ? parseCoarseCigar(coarseStr)
          : undefined

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
      coarseCigar: coarseStr,
      winCumLo,
      winCumHi,
      windowSpan,
      spanRatio: CLIP_SPAN_RATIO,
    })
    let fStart = clip?.start ?? start
    let fEnd = clip?.end ?? end
    let mStart = clip?.mateStart ?? mate.start
    let mEnd = clip?.mateEnd ?? mate.end
    let clippedCigar = clip?.cigar

    // The displayed region each axis shows this block in, resolved once from the
    // block's span. A block that overlaps no displayed region on either axis is
    // genuinely not in view and drops here — the same features the per-endpoint
    // bpToCumBp used to drop, minus the ones that merely straddled an edge.
    const e1 = findRegionEntry(
      v1Index,
      refName,
      Math.min(fStart, fEnd),
      Math.max(fStart, fEnd),
    )
    const e2 = findRegionEntry(
      v2Index,
      mateRefName,
      Math.min(mStart, mEnd),
      Math.max(mStart, mEnd),
    )
    if (!e1 || !e2) {
      continue
    }

    // Trim to the part both regions can show. `a` is the pair (f1s, mStart) and
    // `b` the pair (f1e, mEnd), which is the corner pairing the ribbon draws.
    const trim = clampBlockToRegions({
      a1: strand === -1 ? fEnd : fStart,
      b1: strand === -1 ? fStart : fEnd,
      r1Start: e1.region.start,
      r1End: e1.region.end,
      a2: mStart,
      b2: mEnd,
      r2Start: e2.region.start,
      r2End: e2.region.end,
    })
    if (!trim) {
      continue
    }
    if (trim.trimmed) {
      const qLoRaw = Math.min(trim.a1, trim.b1)
      const qHiRaw = Math.max(trim.a1, trim.b1)
      // Snap the CIGAR window to integer bp before re-trimming — INWARD, so the
      // block stays inside the region `clampBlockToRegions` just fitted it to.
      // (`clipLargeBlockToWindow` snaps the same problem outward, because its
      // window is a viewport bound rather than a containment one.)
      //
      // The trim is proportional, so `trim.a1`/`b1` carry a sub-bp fraction, and
      // `clipSyntenyFeature` trims its boundary ops to exactly the window it is
      // given. A fractional window therefore did two things at once: it packed
      // the boundary op lengths through `(cHi - cLo) << 4`, which truncates, and
      // it re-anchored the block at a fractional `start`. The block's declared
      // span then disagreed with the span its own CIGAR walks — measured at
      // 1.3bp on `100M10D100M10I100M` over a window of (1050.4, 1250.7), with
      // the clipped `10D` packed as a ZERO-length op. Since the base trapezoid
      // is drawn from the corners while the tiles are walked from the CIGAR,
      // transparent-indels mode left that difference as an unpainted sliver at
      // the trailing end, and at base-level zoom 1.3bp is tens of px.
      const qLo = Math.ceil(qLoRaw)
      const qHi = Math.floor(qHiRaw)
      // Re-derive the trimmed span from the CIGAR where there is one: the walk
      // follows the block's real indels, where the proportional trim can only
      // assume the linear correspondence. Without a CIGAR (or when the walk
      // keeps no op, or when snapping leaves no whole bp) the proportional
      // endpoints stand and the block draws as base ribbon only, which is what
      // an untrimmed no-CIGAR block does too.
      const cig = clippedCigar ?? parsedAlignment()
      const re =
        cig && qHi > qLo
          ? clipSyntenyFeature(cig, fStart, mStart, mEnd, strand, qLo, qHi)
          : undefined
      if (re) {
        fStart = re.start
        fEnd = re.end
        mStart = re.mateStart
        mEnd = re.mateEnd
        clippedCigar = re.cigar
      } else {
        // The RAW proportional endpoints, not the snapped ones: this arm draws
        // a base ribbon with no CIGAR, so there is no integer grid for it to sit
        // off, and rounding would only shorten it.
        fStart = qLoRaw
        fEnd = qHiRaw
        mStart = Math.min(trim.a2, trim.b2)
        mEnd = Math.max(trim.a2, trim.b2)
        clippedCigar = cig ? EMPTY_CIGAR : clippedCigar
      }
    }

    // NOTHING HERE ALIGNS: the block keeps a span on the query axis and none at
    // all on the mate's, which is a ribbon collapsing to a vertex rather than a
    // correspondence.
    //
    // A chain converted to PAF is ONE record whose CIGAR carries the chain's
    // gaps as ops, and the top-level chain over a whole chromosome carries
    // enormous ones — chimp chr19 -> hg38 chr17 is a single 86Mb record with a
    // 30,846,489bp `D` where the pericentric inversion is, the inverted segment
    // being a SEPARATE record that covers it. A window inside that gap keeps
    // only query-consuming ops, so `clipSyntenyFeature` re-anchors the block
    // against a mate span of ZERO. That is the clip reporting, correctly, that
    // the chain aligns nothing here.
    //
    // Read as a position instead, the single point it is anchored at became a
    // ribbon 29Mb from the alignments around it, culled by the band, and then
    // marked by `culledRibbonMates` as an off-screen mate — telling the reader
    // to scroll to a mate that does not exist. The records that DO align in the
    // window are already here, so the gap is drawn by leaving it empty.
    //
    // TESTED ON THE FINAL COORDINATES, because the clip runs TWICE and either
    // call can produce this: `clipLargeBlockToWindow` above re-anchors an
    // oversized block to the viewport, and the trim just above re-anchors any
    // block to what the two regions can show — a displayed region that is
    // itself a slice inside the gap reaches the second without ever tripping
    // the first's size gate. Guarding the first call alone left that door open.
    //
    // `fStart < fEnd` because `clampBlockToRegions` can collapse BOTH axes when
    // a block meets a region at a single point, which is a different (and
    // harmless) degeneracy this rule has no business claiming.
    //
    // THE SAME RULE THE FOLLOW ALREADY HAS. `installSyntenyFollow` walks the
    // CIGAR through `resolveAlignmentSpan` and holds the row on a span that
    // comes back empty — "a walk that collapses to a point is not a place" —
    // which is why the follow was never wrong here and the geometry was.
    if (mStart === mEnd && fStart < fEnd) {
      continue
    }

    const f1s = strand === -1 ? fEnd : fStart
    const f1e = strand === -1 ? fStart : fEnd

    const p11 = cumBpInEntry(e1, f1s)
    const p12 = cumBpInEntry(e1, f1e)
    const p21 = cumBpInEntry(e2, mStart)
    const p22 = cumBpInEntry(e2, mEnd)

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
    queryGridAnchorArray[validCount] = cumBpAtGenomicCoord(
      e1,
      RULER_GRID_ORIGIN,
    )
    strandsArray[validCount] = strand
    startsArray[validCount] = start
    endsArray[validCount] = end

    for (const channel of channelList) {
      // dnds is the one derived channel: it is a ratio of two attributes, not
      // an attribute, so nothing on the feature answers to the name
      writeAttribute(
        channel,
        validCount,
        channel.name === 'dnds' ? dnDsRatio(f) : readAttribute(f, channel.name),
      )
    }

    mateStartsArray[validCount] = mate.start
    mateEndsArray[validCount] = mate.end

    featureIds.push(id)
    nameIds[validCount] = nameDict.idFor(f.get('name') ?? '')
    refNameIds[validCount] = refNameDict.idFor(refName)
    assemblyNameIds[validCount] = assemblyNameDict.idFor(
      (f.get('assemblyName') as string | undefined) ?? '',
    )
    mateRefNameIds[validCount] = mateRefNameDict.idFor(mateRefName)
    mateAssemblyNameIds[validCount] = mateAssemblyNameDict.idFor(
      mate.assemblyName,
    )
    // Only parse the CIGAR when it will actually be visited. Chromosome-scale
    // alignments can carry multi-megabyte CIGAR strings (~4 bytes/op in the
    // parsed Uint32Array, so tens of MB per feature). Gate matches the
    // willDrawCigar predicate in buildSyntenyGeometry via the shared
    // MIN_CIGAR_PX_WIDTH — drawCIGAR off or alignment narrower than that means
    // the visitor never fires, and the location markers walk the corners instead
    // (`emitGridMarkers` over the whole feature), which needs no CIGAR. A
    // clipped block already carries its (short) visible-slice CIGAR from the
    // re-anchor above.
    const widthPx0 = topMaxX - topMinX
    const widthPx1 = botMaxX - botMinX
    const willNeedCigar =
      (!!cigarStr || !!coarseStr) &&
      drawCIGAR &&
      Math.max(widthPx0, widthPx1) >= MIN_CIGAR_PX_WIDTH
    parsedCigars.push(
      clippedCigar ??
        (willNeedCigar ? parsedAlignment() : undefined) ??
        EMPTY_CIGAR,
    )

    validCount++
  }

  // cumBp arrays are intermediate buffers consumed only by buildSyntenyGeometry
  // below. They never leave the worker — the main thread reads window-relative
  // Float32 corners (plus `base0`/`base1`) out of `instanceData`. See ADR-067.
  const p11_cumBp = p11Array.subarray(0, validCount)
  const p12_cumBp = p12Array.subarray(0, validCount)
  const p21_cumBp = p21Array.subarray(0, validCount)
  const p22_cumBp = p22Array.subarray(0, validCount)
  const queryGridAnchors = queryGridAnchorArray.subarray(0, validCount)

  const featureData = {
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    ...channels.finish(validCount),
    featureIds,
    nameDict: nameDict.dict,
    nameIds: nameIds.subarray(0, validCount),
    refNameDict: refNameDict.dict,
    refNameIds: refNameIds.subarray(0, validCount),
    assemblyNameDict: assemblyNameDict.dict,
    assemblyNameIds: assemblyNameIds.subarray(0, validCount),
    mateStarts: mateStartsArray.subarray(0, validCount),
    mateEnds: mateEndsArray.subarray(0, validCount),
    mateRefNameDict: mateRefNameDict.dict,
    mateRefNameIds: mateRefNameIds.subarray(0, validCount),
    mateAssemblyNameDict: mateAssemblyNameDict.dict,
    mateAssemblyNameIds: mateAssemblyNameIds.subarray(0, validCount),
    hasCigar,
    offscreenMates: offscreenMates.finish(),
    targetOffscreenMates: targetOffscreenMates.finish(),
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
        queryGridAnchors,
        strands: featureData.strands,
        parsedCigars,
        starts: featureData.starts,
        ends: featureData.ends,
        drawCIGAR,
        drawCIGARMatchesOnly,
        bpPerPx0: v1.bpPerPx,
        bpPerPx1: v2.bpPerPx,
        viewOff0: v1.offsetPx,
        viewOff1: v2.offsetPx,
        viewWidth,
      }),
  )

  // Derived rather than hand-listed. The list this replaces named eighteen
  // buffers in two groups and had no dedup, so `attributes` gaining a channel
  // that aliases another field, or `instanceData` gaining an array, was a
  // DataCloneError naming an index in a list nobody could see.
  return rpcResultWithArrayBuffers({ ...featureData, instanceData })
}
