import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
  parseCigar2Typed,
  parseCoarseCigar,
} from '@jbrowse/cigar-utils'

import type { BpRegionIndex } from './bpRegionIndex.ts'

// Per-perspective PIF/PAF CIGAR consumption, matching buildSyntenyGeometry's
// walk: bp1 (query / v1 side) advances on M/=/X and D/N; bp2 (target / v2 side)
// advances on M/=/X and I. The D<->I asymmetry is the pre-swap the PIF t-line
// carries, so a clip produced here stays consistent when it feeds back through
// the same convention.
//
// Spelled as ENUMERATED op sets, so H/S/P advance NEITHER axis. That is the
// convention every other walk in the tree uses — `visitCigarRenderedSegments`
// (the walk this clip's own output is re-walked by, which has no branch for them
// at all) and `findPosInCigar`, whose header says so explicitly. Written as
// `op !== CIGAR_I` / `op !== CIGAR_D && op !== CIGAR_N` these advanced BOTH axes
// on a clip, which stays invisible only because a PAF/PIF CIGAR carries none. A
// BAM-sourced one does: "Linear read vs ref" hands the read's raw CIGAR through
// verbatim while putting the mate in read coordinates that already EXCLUDE the
// clip (`buildReadVsRefFeatures`, `clipLengthAtStartOfRead`). So a leading
// `100S` walked the re-anchored block 100bp along both axes past where the block
// says it starts, and since `clipLargeBlockToWindow` fires once a block exceeds
// 4x the window — ~1bp/px on a 20kb read segment, an ordinary inspection zoom —
// every CIGAR tile and marker on it landed 100bp short of the ribbon it sits in,
// which in transparent-indels mode is a hole at the trailing end.
//
// Bitmasks in `((1 << op) & MASK)` form, the idiom `CIGAR_INDEL_MASK` already
// carries in this directory (buildSyntenyGeometry's `cigarSegmentKind`), so
// membership is one test rather than a chain of five. Built from the op
// constants rather than written as literals: the point of the fix is that the
// SET is the thing to read, and `0b110001101` hides it. Deliberately local —
// `visitCigarRenderedSegments` is the authority here and it branches per op to
// decide WHICH axis, so a mask does not fit it, and a shared one it could not
// use would just be a second statement of the same convention.
const V1_OPS =
  (1 << CIGAR_M) |
  (1 << CIGAR_EQ) |
  (1 << CIGAR_X) |
  (1 << CIGAR_D) |
  (1 << CIGAR_N)
const V2_OPS =
  (1 << CIGAR_M) | (1 << CIGAR_EQ) | (1 << CIGAR_X) | (1 << CIGAR_I)
const MATCH_OPS = (1 << CIGAR_M) | (1 << CIGAR_EQ) | (1 << CIGAR_X)

function consumesQuery(op: number) {
  return ((1 << op) & V1_OPS) !== 0
}
function consumesTarget(op: number) {
  return ((1 << op) & V2_OPS) !== 0
}
function isMatchOp(op: number) {
  return ((1 << op) & MATCH_OPS) !== 0
}

export interface ClippedSyntenyFeature {
  start: number
  end: number
  mateStart: number
  mateEnd: number
  cigar: Uint32Array
}

// Trim a synteny feature + its CIGAR to a query-space window
// [winStart, winEnd], returning the re-anchored coords + trimmed CIGAR, or
// undefined if the block doesn't overlap the window.
//
// **`winStart`/`winEnd` MUST be integer bp**, and both callers snap them —
// outward in `clipLargeBlockToWindow` (a viewport bound), inward in
// `executeSyntenyFeaturesAndPositions`' trim path (a region-containment bound).
// A fractional window breaks the output two ways at once: the boundary ops are
// trimmed to it and then packed through `(cHi - cLo) << 4`, whose ToInt32
// TRUNCATES the length (a 0.6bp remnant becomes a zero-length op), while
// `start`/`end` come back carrying the fraction in full. The block's declared
// span then exceeds what its own CIGAR walks, and since the base trapezoid is
// drawn from the corners while the tiles are walked from the ops, the
// difference shows in transparent-indels mode as unpainted ribbon at the
// trailing end. Not asserted here — this runs per feature over a whole-genome
// PAF — so it is the callers' invariant to keep.
//
// A single alignment block can span far beyond the viewport — a whole UCSC
// liftOver chain is one ~20 Mb feature. Its base ribbon is drawn as one *linear*
// trapezoid across that span, which cannot follow megabases of indels, so at
// high zoom the ribbon lands off-screen and nothing renders. Re-anchoring the
// block to just its visible slice (accurate coords + a short CIGAR) restores it.
//
// Walk direction MUST match buildSyntenyGeometry, which walks the query (v1)
// axis forward in GENOMIC order for BOTH strands and flips only the target (v2)
// axis. So the query walk here is always start->end; only the target counts
// down for a - strand block, entering at mateEnd. Within a match op the target
// maps to the query as target(q) = bp2 + (q - bp1) * revTarget, using the op's
// walk-entry positions. (buildSyntenyGeometry re-derives its rev1 from the cumBp
// order of the endpoints, so a reversed display region walks the same file-order
// CIGAR the other way in cumBp space — still forward in genomic query bp, so
// this reassembly stays valid.)
//
// Walking the query backward for - strand (as an earlier version did) mirrors
// every indel's query position within the window: the trimmed CIGAR is
// reassembled in file order and re-walked forward by buildSyntenyGeometry, so a
// deletion lands at its mirror-image position (wrong side of the ribbon).
export function clipSyntenyFeature(
  cigar: Uint32Array,
  start: number,
  mateStart: number,
  mateEnd: number,
  strand: number,
  winStart: number,
  winEnd: number,
): ClippedSyntenyFeature | undefined {
  const revTarget = strand === -1 ? -1 : 1
  let bp1 = start
  let bp2 = strand === -1 ? mateEnd : mateStart
  const out: number[] = []
  let qLo = Infinity
  let qHi = -Infinity
  let tLo = Infinity
  let tHi = -Infinity
  const extendTarget = (a: number, b: number) => {
    tLo = Math.min(tLo, a, b)
    tHi = Math.max(tHi, a, b)
  }
  for (let k = 0; k < cigar.length; k++) {
    const packed = cigar[k]!
    const len = packed >>> 4
    const op = packed & 0xf
    // a CIGAR_RUN pair advances the query by its first word and the target by
    // its second, mapping the two in proportion along the run
    const isRun = op === CIGAR_RUN
    const qAdv = isRun || consumesQuery(op) ? len : 0
    const tAdv = isRun ? cigar[++k]! >>> 4 : consumesTarget(op) ? len : 0
    const bp1Next = bp1 + qAdv
    const bp2Next = bp2 + tAdv * revTarget
    const opQLo = bp1
    const opQHi = bp1Next
    if (opQHi >= winStart && opQLo <= winEnd) {
      if (qAdv > 0) {
        // Query-consuming op (match, run or D/N): trim to the window in query
        // space.
        const cLo = Math.max(opQLo, winStart)
        const cHi = Math.min(opQHi, winEnd)
        if (cHi > cLo) {
          qLo = Math.min(qLo, cLo)
          qHi = Math.max(qHi, cHi)
          if (isRun) {
            const ratio = tAdv / len
            const keptOwn = cHi - cLo
            const keptMate = Math.round(keptOwn * ratio)
            const tEntry = Math.round(bp2 + (cLo - bp1) * ratio * revTarget)
            out.push((keptOwn << 4) | CIGAR_RUN, (keptMate << 4) | CIGAR_RUN)
            extendTarget(tEntry, tEntry + keptMate * revTarget)
          } else {
            out.push(((cHi - cLo) << 4) | op)
            if (isMatchOp(op)) {
              // matches map target 1:1: target(q) = bp2 + (q - bp1) * revTarget
              extendTarget(
                bp2 + (cLo - bp1) * revTarget,
                bp2 + (cHi - bp1) * revTarget,
              )
            } else {
              // D/N consume no target, so it stays a point at bp2
              extendTarget(bp2, bp2)
            }
          }
        }
      } else if (tAdv > 0) {
        // I (or a run with no query span): target-consuming gap at a single
        // query position; keep it whole
        if (isRun) {
          out.push(packed, cigar[k]!)
        } else {
          out.push(packed)
        }
        qLo = Math.min(qLo, bp1)
        qHi = Math.max(qHi, bp1)
        extendTarget(bp2, bp2Next)
      }
      // An op consuming NEITHER axis (H/S/P) is dropped rather than falling into
      // the arm above. It carries no coordinate on either axis, so keeping it
      // would extend qLo/qHi to a position the alignment does not occupy — and
      // on a hard clip sitting exactly at winEnd, with the preceding match
      // trimmed to nothing, that arm is the ONLY thing that collects, so the
      // clip alone would come back as a zero-width block. The walk this output
      // feeds (visitCigarRenderedSegments) has no branch for these ops either.
    }
    bp1 = bp1Next
    bp2 = bp2Next
    // Query ascends monotonically, so every later op has opQLo >= bp1 > winEnd
    // and cannot overlap the window — whether or not anything has been collected
    // yet. This used to also require `out.length`, which disabled the break for
    // the one input that walks longest: a block lying entirely to the RIGHT of
    // the window never collects an op, so it read every op of a multi-megabyte
    // chain to conclude what the first op already said.
    if (bp1 > winEnd) {
      break
    }
  }
  if (out.length === 0) {
    return undefined
  }
  return {
    start: qLo,
    end: qHi,
    mateStart: tLo,
    mateEnd: tHi,
    cigar: Uint32Array.from(out),
  }
}

function isGapOp(op: number) {
  return op === CIGAR_I || op === CIGAR_D || op === CIGAR_N
}

/**
 * The gap-free runs of a block: the block cut at every insertion or deletion
 * of `gapBp` or more, each run re-anchored on both axes with its own ops, in
 * the shape {@link clipSyntenyFeature} answers with so a run can then be
 * clipped to a window like any block. Cut BEFORE the clip rather than after
 * it, because a clip trims a gap straddling the window edge to the part
 * inside, and a 25 kb deletion 9 kb of which is in view is still a gap. The
 * walk is the clip's own — query forward, target down for a - strand block
 * from `mateEnd` — and a run's `mateStart`/`mateEnd` are its target extent
 * in ascending order. A run is only what aligned: one holding no match or
 * coarse-run op (a stretch that is deletions alone) is dropped, and a gap at
 * either edge of the block leaves no empty run behind it.
 *
 * Wanted by a display that draws a clipped record as one straight placement
 * and has no CIGAR left to consult: a chain carrying a 25 kb indel inside the
 * window drew as one ribbon, and what it draws now is one placement per run.
 * The coarse tier keeps every indel longer than half its bound as its own op,
 * so a `gapBp` at that bound splits the same way on either tier.
 */
export function splitSyntenyFeatureAtGaps(
  cigar: Uint32Array,
  start: number,
  mateStart: number,
  mateEnd: number,
  strand: number,
  gapBp: number,
): ClippedSyntenyFeature[] {
  const revTarget = strand === -1 ? -1 : 1
  const runs: ClippedSyntenyFeature[] = []
  let bp1 = start
  let bp2 = strand === -1 ? mateEnd : mateStart
  let run:
    | { qLo: number; qHi: number; tLo: number; tHi: number; ops: number[] }
    | undefined
  let aligned = false
  const close = () => {
    if (run !== undefined && aligned && run.qHi > run.qLo) {
      runs.push({
        start: run.qLo,
        end: run.qHi,
        mateStart: run.tLo,
        mateEnd: run.tHi,
        cigar: Uint32Array.from(run.ops),
      })
    }
    run = undefined
    aligned = false
  }
  for (let k = 0; k < cigar.length; k++) {
    const packed = cigar[k]!
    const len = packed >>> 4
    const op = packed & 0xf
    const isRun = op === CIGAR_RUN
    const second = isRun ? cigar[++k]! : undefined
    const qAdv = isRun || consumesQuery(op) ? len : 0
    const tAdv =
      second !== undefined ? second >>> 4 : consumesTarget(op) ? len : 0
    const bp2Next = bp2 + tAdv * revTarget
    if (isGapOp(op) && len >= gapBp) {
      close()
    } else if (qAdv > 0 || tAdv > 0) {
      if (run === undefined) {
        run = { qLo: bp1, qHi: bp1, tLo: bp2, tHi: bp2, ops: [] }
      }
      run.qHi = bp1 + qAdv
      run.tLo = Math.min(run.tLo, bp2, bp2Next)
      run.tHi = Math.max(run.tHi, bp2, bp2Next)
      run.ops.push(packed)
      if (second !== undefined) {
        run.ops.push(second)
      }
      aligned = aligned || isRun || isMatchOp(op)
    }
    bp1 += qAdv
    bp2 = bp2Next
  }
  close()
  return runs
}

// Worker glue over clipSyntenyFeature: gate on size + resolve the v1 region the
// fetch window is over, convert the window to that region's local bp, parse
// the CIGAR (or the coarse tier's fold of it) and clip. Returns undefined
// (leave the block untouched) unless it is a block with an alignment string
// more than `spanRatio`x the window on a clippable region. The clip
// itself is region-orientation-agnostic (it walks genomic query bp forward), and
// buildSyntenyGeometry re-derives its rev1 from the cumBp order of the clipped
// endpoints — so a reversed v1 region only changes the cumBp->local-bp window
// mapping below, not the clip or the downstream projection.
export function clipLargeBlockToWindow({
  v1Index,
  refName,
  start,
  end,
  mateStart,
  mateEnd,
  strand,
  cigar,
  coarseCigar,
  winCumLo,
  winCumHi,
  windowSpan,
  spanRatio,
}: {
  v1Index: BpRegionIndex
  refName: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
  cigar: string | undefined
  coarseCigar?: string
  winCumLo: number
  winCumHi: number
  windowSpan: number
  spanRatio: number
}): ClippedSyntenyFeature | undefined {
  if ((!cigar && !coarseCigar) || end - start <= spanRatio * windowSpan) {
    return undefined
  }
  // Re-anchor to the region this refName's fetch window falls in. A refName
  // can be displayed at several loci at once — e.g. a dispersed gene duplication
  // shows the same contig in multiple regions — so pick the region whose cumBp
  // span overlaps the window most (for the common single-region case, just that
  // region; no overlap = the block is off-screen, leave it untouched). Assumes
  // the same-refName regions are genomically DISJOINT (which the duplication
  // case is): the downstream projection re-resolves the clipped coords with
  // findRegionEntry, which picks the region their span overlaps MOST — the same
  // region we clipped to only when the genomic ranges don't overlap. Overlapping
  // copies of one locus would need a region index threaded through.
  const entries = v1Index.entries.get(refName) ?? []
  let r0: (typeof entries)[number] | undefined
  let bestOverlap = 0
  for (const e of entries) {
    const regLo = e.bpBefore
    const regHi = e.bpBefore + (e.region.end - e.region.start)
    const overlap = Math.min(winCumHi, regHi) - Math.max(winCumLo, regLo)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      r0 = e
    }
  }
  if (!r0) {
    return undefined
  }
  // Snap the window to integer bp (widen outward). winCumLo/Hi come off a
  // fetch window snapped to a pixel-derived grid, so they can carry a sub-bp
  // fraction. The
  // window is only a coarse "which ops to include" bound, but the clip trims
  // the boundary match op to start exactly at winStart — a fractional winStart
  // makes the whole re-anchored block's coords fractional (the op lengths stay
  // integer), rigidly shifting every tile/indel off the true integer-bp grid by
  // that fraction. At several px/bp that reads as indels landing mid-basepair,
  // misaligned vs the exact-bp LGVSyntenyDisplay. Flooring/ceiling keeps the
  // clipped block on the alignment's integer grid; the <1bp widening is well
  // inside the pan buffer.
  //
  // Invert bpToCumBp for this region's orientation. Forward: local =
  // cumBp - bpBefore + start (monotonic up). Reversed: local =
  // end - (cumBp - bpBefore) (monotonic down), so the low/high cumBp bounds map
  // to the high/low local bp — winStart takes winCumHi and winEnd winCumLo.
  //
  // Clamped to the region, because the cumBp window spans every displayed
  // region and this maps it through one of them: on a multi-region view the
  // window is wider than the region it is being expressed in, so an unclamped
  // winStart lands outside and the re-anchored block keeps an endpoint the
  // projection cannot place.
  const { region, bpBefore } = r0
  const clampToRegion = (bp: number) =>
    Math.min(Math.max(bp, region.start), region.end)
  const winStart = clampToRegion(
    region.reversed
      ? Math.floor(region.end - (winCumHi - bpBefore))
      : Math.floor(winCumLo - bpBefore + region.start),
  )
  const winEnd = clampToRegion(
    region.reversed
      ? Math.ceil(region.end - (winCumLo - bpBefore))
      : Math.ceil(winCumHi - bpBefore + region.start),
  )
  // A block that doesn't reach the window keeps no op — every op the walk below
  // retains has to overlap [winStart, winEnd], and the walk only ever moves
  // forward from `start` — so answer that here, before parsing a multi-megabyte
  // CIGAR string, which is exactly the size of block that reaches this function
  // at all. The window is the fetch window, so a fetched block reaches it
  // unless the same refName is displayed at several loci and the block belongs
  // to another of them.
  if (end < winStart || start > winEnd) {
    return undefined
  }
  const ops = cigar
    ? parseCigar2Typed(cigar)
    : coarseCigar
      ? parseCoarseCigar(coarseCigar)
      : undefined
  return ops
    ? clipSyntenyFeature(
        ops,
        start,
        mateStart,
        mateEnd,
        strand,
        winStart,
        winEnd,
      )
    : undefined
}
