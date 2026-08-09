// Trimming an alignment block to what the displayed regions can actually show.

export interface ClampedBlock {
  a1: number
  b1: number
  a2: number
  b2: number
  /** the clamp trimmed something — the CIGAR (if any) needs re-trimming to match */
  trimmed: boolean
}

// The parameter window over which `a + t*(b - a)` stays inside [lo, hi],
// narrowed into the running [t0, t1]. Returns false when the axis never is.
//
// Scalar in/out rather than a returned pair: this runs twice per feature over a
// whole-genome PAF, where a two-element array per axis is millions of
// short-lived allocations for arithmetic that fits in registers. Same reason
// projectCorners takes a scratch object.
function narrow(
  t: { t0: number; t1: number },
  a: number,
  b: number,
  lo: number,
  hi: number,
) {
  if (a === b) {
    return a >= lo && a <= hi
  }
  const ta = (lo - a) / (b - a)
  const tb = (hi - a) / (b - a)
  // a descending axis (a - strand mate, a reversed region) maps lo to the high
  // parameter, so order the pair rather than assuming ta <= tb
  t.t0 = Math.max(t.t0, Math.min(ta, tb))
  t.t1 = Math.min(t.t1, Math.max(ta, tb))
  return true
}

// Trim an alignment block to the part BOTH displayed regions can show.
//
// A block whose endpoint falls outside the region its axis is showing used to be
// dropped whole, because the projection asked `bpToCumBp` per endpoint and got
// undefined. That is invisible on the well-trodden path — a view showing whole
// chromosomes contains every coordinate — and wrong the moment a view is
// narrowed to a locus: the `loc: 'chr3:25,358,900-25,359,700 ...'` multi-region
// view in the cancer_sv figures showed three of its four segments, the missing
// one being the 32.7 kb arm whose far end is 32 kb off the left of its region.
//
// The trim is proportional along the block, in BOTH axes at once, because that
// is the correspondence the base ribbon draws: a linear trapezoid from
// (a1, a2) to (b1, b2). Clamping each axis on its own would move one edge of the
// ribbon without moving the coordinate it points at, landing the ribbon on the
// wrong part of the other genome. Trimming in the shared parameter t keeps every
// point of the shortened ribbon on the correspondence the full one carried.
//
// `a1`/`a2` are the paired endpoints (`a1` maps to `a2`), which for a - strand
// block means a1 is the block's genomic END. Callers pass the same pairing the
// geometry does — see the corner order in buildSyntenyGeometry's addInstance.
export function clampBlockToRegions({
  a1,
  b1,
  r1Start,
  r1End,
  a2,
  b2,
  r2Start,
  r2End,
}: {
  a1: number
  b1: number
  r1Start: number
  r1End: number
  a2: number
  b2: number
  r2Start: number
  r2End: number
}): ClampedBlock | undefined {
  const t = { t0: 0, t1: 1 }
  if (
    !narrow(t, a1, b1, r1Start, r1End) ||
    !narrow(t, a2, b2, r2Start, r2End) ||
    t.t1 < t.t0
  ) {
    return undefined
  }
  const { t0, t1 } = t
  const trimmed = t0 > 0 || t1 < 1
  // An untrimmed block returns its own endpoints, not `a + 1*(b - a)`, which is
  // b only up to rounding. The overwhelming majority of blocks take this branch
  // (every view showing whole chromosomes contains every coordinate), and a
  // sub-bp drift on all of them would move CIGAR tiles off the integer grid for
  // no reason — the same drift clipLargeBlockToWindow floors its window to avoid.
  return trimmed
    ? {
        a1: a1 + t0 * (b1 - a1),
        b1: a1 + t1 * (b1 - a1),
        a2: a2 + t0 * (b2 - a2),
        b2: a2 + t1 * (b2 - a2),
        trimmed,
      }
    : { a1, b1, a2, b2, trimmed }
}
