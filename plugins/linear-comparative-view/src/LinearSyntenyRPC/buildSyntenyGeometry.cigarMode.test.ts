import { CIGAR_D, CIGAR_I, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_MARKER,
} from './syntenyKinds.ts'
import { viewportWindow } from './testUtils.ts'

// One feature, CIGAR M50 D50 M50 at bpPerPx=1. The deletion consumes the top
// (query) axis but not the bottom (target) axis, so on the top axis it occupies
// the bp interval [50, 100). Both match runs (50px) and the deletion (50px) are
// well above MIN_CIGAR_PX_WIDTH / MIN_INDEL_PX, so all render.
const packed = (len: number, op: number) => (len << 4) | op

function build(
  matchesOnly: boolean,
  cigar = [packed(50, CIGAR_M), packed(50, CIGAR_D), packed(50, CIGAR_M)],
  end1 = 150,
  end2 = 100,
) {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([end1]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([end2]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [cigar],
    cigarMode: matchesOnly ? 'matches' : 'full',
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 200,
    window0: viewportWindow({ viewOff: 0, viewWidth: 200, bpPerPx: 1 }),
    window1: viewportWindow({ viewOff: 0, viewWidth: 200, bpPerPx: 1 }),
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

const INDEL_PAIR = [
  packed(50, CIGAR_M),
  packed(60, CIGAR_D),
  packed(50, CIGAR_I),
  packed(50, CIGAR_M),
]

test('colored indels: a deletion meeting an insertion is left see-through', () => {
  const g = build(false, INDEL_PAIR, 160, 150)
  const ribbons = ribbonKinds(g)

  expect(ribbons.some(e => e.k === KIND_CIGAR_D || e.k === KIND_CIGAR_I)).toBe(
    false,
  )
  expect(ribbons.some(e => e.k === KIND_BASE)).toBe(false)
  expect(ribbons.some(e => covers(topSpan(g, e.i), 80))).toBe(false)
  expect(ribbons.some(e => covers(topSpan(g, e.i), 25))).toBe(true)
  expect(ribbons.some(e => covers(topSpan(g, e.i), 135))).toBe(true)
})

test('colored indels: a lone deletion still rides a full-span base', () => {
  const g = build(false)
  expect(ribbonKinds(g).some(e => e.k === KIND_BASE)).toBe(true)
})

test('transparent indels: a deletion meeting an insertion stays see-through', () => {
  const g = build(true, INDEL_PAIR, 160, 150)
  const ribbons = ribbonKinds(g)

  expect(ribbons.some(e => covers(topSpan(g, e.i), 80))).toBe(false)
})

test('no location marker lands inside a deletion meeting an insertion', () => {
  const g = build(false, INDEL_PAIR, 160, 150)
  const markerTops = [...g.kinds]
    .map((k, i) => ({ k, i }))
    .filter(e => e.k === KIND_MARKER)
    .map(e => g.bp1[e.i]! + g.base0)

  expect(markerTops.length).toBeGreaterThan(0)
  expect(markerTops.some(bp => bp > 50 && bp < 110)).toBe(false)
})

test('transparent indels: matches between sub-pixel-spaced deletions are painted', () => {
  const cigar = Array.from({ length: 200 }, (_, i) =>
    i % 2 ? packed(150, CIGAR_D) : packed(50, CIGAR_M),
  )
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([20_000]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([5_000]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [cigar],
    cigarMode: 'matches',
    bpPerPx0: 100,
    bpPerPx1: 100,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 400,
    window0: viewportWindow({ viewOff: 0, viewWidth: 400, bpPerPx: 100 }),
    window1: viewportWindow({ viewOff: 0, viewWidth: 400, bpPerPx: 100 }),
  })
  const tiles = ribbonKinds(g).filter(e => e.k === KIND_BASE_TILE)
  expect(tiles.length).toBe(100)
})

test('a feature with more ops than pixels keeps every rendered deletion', () => {
  const unit = [packed(2, CIGAR_M), packed(1001, CIGAR_D), packed(1, CIGAR_M)]
  const cigar = Array.from({ length: 900 }, () => unit).flat()
  const window = viewportWindow({ viewOff: 0, viewWidth: 1000, bpPerPx: 1000 })
  const geometry = (cigarMode: 'full' | 'matches') =>
    buildSyntenyGeometry({
      p11_cumBp: new Float64Array([0]),
      p12_cumBp: new Float64Array([900 * 1004]),
      p21_cumBp: new Float64Array([0]),
      p22_cumBp: new Float64Array([900 * 3]),
      queryGridAnchors: new Float64Array([0]),
      strands: new Int8Array([1]),
      parsedCigars: [cigar],
      cigarMode,
      bpPerPx0: 1000,
      bpPerPx1: 1000,
      viewOff0: 0,
      viewOff1: 0,
      viewWidth: 1000,
      window0: window,
      window1: window,
    })

  const colored = ribbonKinds(geometry('full'))
  expect(colored.filter(e => e.k === KIND_CIGAR_D)).toHaveLength(900)
  const transparent = ribbonKinds(geometry('matches'))
  expect(transparent.filter(e => e.k === KIND_BASE_TILE)).toHaveLength(901)
})
