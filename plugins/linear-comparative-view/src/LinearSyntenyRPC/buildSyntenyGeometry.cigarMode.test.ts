import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_CIGAR_D,
  KIND_MARKER,
} from './syntenyColors.ts'

// One feature, CIGAR M50 D50 M50 at bpPerPx=1. The deletion consumes the top
// (query) axis but not the bottom (target) axis, so on the top axis it occupies
// the bp interval [50, 100). Both match runs (50px) and the deletion (50px) are
// well above MIN_CIGAR_PX_WIDTH / MIN_INDEL_PX, so all render.
function build(drawCIGARMatchesOnly: boolean) {
  const packed = (len: number, op: number) => (len << 4) | op
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([150]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([100]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [
      [packed(50, CIGAR_M), packed(50, CIGAR_D), packed(50, CIGAR_M)],
    ],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([150]),
    drawCIGAR: true,
    drawCIGARMatchesOnly,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 200,
  })
}

// Top-axis [start, end] bp interval of instance i (bp1 = top-left corner,
// bp2 = top-right corner; see addInstance corner order). Corners are window-
// relative but base0 == 0 here (viewOff0 == 0), so they equal cumBp.
function topSpan(g: ReturnType<typeof build>, i: number) {
  return [g.bp1[i]! + g.base0, g.bp2[i]! + g.base0] as const
}

function covers(span: readonly [number, number], bp: number) {
  const [lo, hi] = span[0] <= span[1] ? span : [span[1], span[0]]
  return lo <= bp && bp <= hi
}

// This 150px feature is wide enough to carry location markers, and the worker
// emits those unconditionally — the toggle is a color-lane decision (see
// `computeSyntenyColors`). Every assertion below is about how cigarMode PAINTS a
// ribbon, so it reads the ribbon instances only; a tick landing on the deletion
// would otherwise read as coverage of it.
function ribbonKinds(g: ReturnType<typeof build>) {
  return [...g.kinds].map((k, i) => ({ k, i })).filter(e => e.k !== KIND_MARKER)
}

test('colored indels: full-span base covers the deletion, plus a D quad on top', () => {
  const g = build(false)
  const ribbons = ribbonKinds(g)

  // Exactly one colored deletion quad.
  expect(ribbons.filter(e => e.k === KIND_CIGAR_D).length).toBe(1)

  // A KIND_BASE block spans the whole feature (0..150), so bp 75 (mid-deletion
  // on the top axis) is painted by the base.
  const baseCoversDeletion = ribbons.some(
    e => e.k === KIND_BASE && covers(topSpan(g, e.i), 75),
  )
  expect(baseCoversDeletion).toBe(true)
})

test('transparent indels: match segments only, deletion region left unpainted', () => {
  const g = build(true)
  const ribbons = ribbonKinds(g)

  // No colored indel quads, and no full-span base — only per-match-segment
  // tiles, which carry their own kind precisely so the renderers can fade them
  // by width where a whole-span base is not faded at all.
  expect(ribbons.every(e => e.k === KIND_BASE_TILE)).toBe(true)
  expect(ribbons.some(e => e.k === KIND_BASE)).toBe(false)

  // No instance covers bp 75 (mid-deletion) on the top axis: the indel shows
  // through. The two match runs [0,50] and [100,150] are drawn.
  const ribbonCoversBp = (bp: number) =>
    ribbons.some(e => covers(topSpan(g, e.i), bp))
  expect(ribbonCoversBp(75)).toBe(false)
  expect(ribbonCoversBp(25)).toBe(true)
  expect(ribbonCoversBp(125)).toBe(true)
})
