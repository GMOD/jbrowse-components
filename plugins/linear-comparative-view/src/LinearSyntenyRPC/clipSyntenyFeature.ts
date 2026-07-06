import { parseCigar2Typed } from '@jbrowse/alignments-core'
import { CIGAR_D, CIGAR_EQ, CIGAR_M, CIGAR_N, CIGAR_X } from '@jbrowse/cigar-utils'

import type { BpRegionIndex } from '@jbrowse/synteny-core'

// Per-perspective PIF/PAF CIGAR consumption, matching buildSyntenyGeometry's
// walk: bp1 (query / v1 side) advances on M/=/X and D/N; bp2 (target / v2 side)
// advances on M/=/X and I. The D<->I asymmetry is the pre-swap the PIF t-line
// carries, so a clip produced here stays consistent when it feeds back through
// the same convention.
function consumesQuery(op: number) {
  return op !== 1 // everything except I(=1)
}
function consumesTarget(op: number) {
  return op !== CIGAR_D && op !== CIGAR_N
}
function isMatchOp(op: number) {
  return op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X
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
// A single alignment block can span far beyond the viewport — a whole UCSC
// liftOver chain is one ~20 Mb feature. Its base ribbon is drawn as one *linear*
// trapezoid across that span, which cannot follow megabases of indels, so at
// high zoom the ribbon lands off-screen and nothing renders. Re-anchoring the
// block to just its visible slice (accurate coords + a short CIGAR) restores it.
//
// `strand` picks the walk direction (matching buildSyntenyGeometry via
// rev = strand): +1 walks query start->end / target mateStart->mateEnd; -1 walks
// both from the far end. Within a match op the target maps to the query 1:1 as
// target(q) = bp2 + (q - bp1) using the op's walk-entry positions (rev cancels).
export function clipSyntenyFeature(
  cigar: Uint32Array,
  start: number,
  end: number,
  mateStart: number,
  mateEnd: number,
  strand: number,
  winStart: number,
  winEnd: number,
): ClippedSyntenyFeature | undefined {
  const rev = strand === -1 ? -1 : 1
  let bp1 = strand === -1 ? end : start
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
    const qAdv = consumesQuery(op) ? len : 0
    const tAdv = consumesTarget(op) ? len : 0
    const bp1Next = bp1 + qAdv * rev
    const bp2Next = bp2 + tAdv * rev
    const opQLo = Math.min(bp1, bp1Next)
    const opQHi = Math.max(bp1, bp1Next)
    if (opQHi >= winStart && opQLo <= winEnd) {
      if (isMatchOp(op)) {
        const cLo = Math.max(opQLo, winStart)
        const cHi = Math.min(opQHi, winEnd)
        if (cHi > cLo) {
          out.push(((cHi - cLo) << 4) | op)
          qLo = Math.min(qLo, cLo)
          qHi = Math.max(qHi, cHi)
          // target(q) = bp2 + (q - bp1) (walk-entry bp1/bp2; rev cancels)
          extendTarget(bp2 + (cLo - bp1), bp2 + (cHi - bp1))
        }
      } else if (qAdv > 0) {
        // D/N: query-consuming gap (target is a point at bp2)
        const cLo = Math.max(opQLo, winStart)
        const cHi = Math.min(opQHi, winEnd)
        if (cHi > cLo) {
          out.push(((cHi - cLo) << 4) | op)
          qLo = Math.min(qLo, cLo)
          qHi = Math.max(qHi, cHi)
          extendTarget(bp2, bp2)
        }
      } else if (bp1 >= winStart && bp1 <= winEnd) {
        // I: target-consuming gap at a single query position; keep it whole
        out.push(packed)
        qLo = Math.min(qLo, bp1)
        qHi = Math.max(qHi, bp1)
        extendTarget(bp2, bp2Next)
      }
    }
    bp1 = bp1Next
    bp2 = bp2Next
    // query is monotonic in the walk direction, so once past the window we can
    // stop (only after collecting at least one op)
    if (out.length && (rev === 1 ? bp1 > winEnd : bp1 < winStart)) {
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

// Worker glue over clipSyntenyFeature: gate on size + a single non-reversed v1
// region, convert the visible cumBp window to that region's local bp, parse the
// CIGAR and clip. Returns undefined (leave the block untouched) unless it is a
// CIGAR block more than `spanRatio`x the window on a clippable region.
export function clipLargeBlockToWindow({
  v1Index,
  refName,
  start,
  end,
  mateStart,
  mateEnd,
  strand,
  cigar,
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
  winCumLo: number
  winCumHi: number
  windowSpan: number
  spanRatio: number
}): ClippedSyntenyFeature | undefined {
  if (!cigar || end - start <= spanRatio * windowSpan) {
    return undefined
  }
  const entry = v1Index.entries.get(refName)
  const r0 = entry?.length === 1 ? entry[0] : undefined
  if (!r0 || r0.region.reversed) {
    return undefined
  }
  const winStart = winCumLo - r0.bpBefore + r0.region.start
  const winEnd = winCumHi - r0.bpBefore + r0.region.start
  return clipSyntenyFeature(
    parseCigar2Typed(cigar),
    start,
    end,
    mateStart,
    mateEnd,
    strand,
    winStart,
    winEnd,
  )
}
