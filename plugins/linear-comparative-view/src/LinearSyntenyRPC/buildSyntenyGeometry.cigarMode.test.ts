import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { KIND_BASE, KIND_CIGAR_D } from './syntenyColors.ts'

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
    strands: new Int8Array([1]),
    parsedCigars: [
      [packed(50, CIGAR_M), packed(50, CIGAR_D), packed(50, CIGAR_M)],
    ],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([150]),
    drawCIGAR: true,
    drawCIGARMatchesOnly,
    drawLocationMarkers: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 200,
  })
}

// Top-axis [start, end] bp interval of instance i (bp1 = top-left corner,
// bp2 = top-right corner; see addInstance corner order).
function topSpan(g: ReturnType<typeof build>, i: number) {
  return [g.bp1Hi[i]! + g.bp1Lo[i]!, g.bp2Hi[i]! + g.bp2Lo[i]!] as const
}

function covers(span: readonly [number, number], bp: number) {
  const [lo, hi] = span[0] <= span[1] ? span : [span[1], span[0]]
  return lo <= bp && bp <= hi
}

test('colored indels: full-span base covers the deletion, plus a D quad on top', () => {
  const g = build(false)
  const kinds = [...g.kinds]

  // Exactly one colored deletion quad.
  expect(kinds.filter(k => k === KIND_CIGAR_D).length).toBe(1)

  // A KIND_BASE block spans the whole feature (0..150), so bp 75 (mid-deletion
  // on the top axis) is painted by the base.
  const baseCoversDeletion = kinds.some(
    (k, i) => k === KIND_BASE && covers(topSpan(g, i), 75),
  )
  expect(baseCoversDeletion).toBe(true)
})

test('transparent indels: match segments only, deletion region left unpainted', () => {
  const g = build(true)
  const kinds = [...g.kinds]

  // No colored indel quads, and no full-span base — only per-match-segment
  // KIND_BASE tiles.
  expect(kinds.every(k => k === KIND_BASE)).toBe(true)

  // No instance covers bp 75 (mid-deletion) on the top axis: the indel shows
  // through. The two match runs [0,50] and [100,150] are drawn.
  const anyCoversDeletion = kinds.some((_k, i) => covers(topSpan(g, i), 75))
  expect(anyCoversDeletion).toBe(false)

  const matchCoversBp = (bp: number) =>
    kinds.some((_k, i) => covers(topSpan(g, i), bp))
  expect(matchCoversBp(25)).toBe(true)
  expect(matchCoversBp(125)).toBe(true)
})
