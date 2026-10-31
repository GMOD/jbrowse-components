import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { viewportWindow } from './testUtils.ts'

// Corners are stored WINDOW-RELATIVE (cumBp minus a per-axis fetch base) as a
// single Float32 — no hi/lo split. The base keeps on-screen corners small so a
// single Float32 stays sub-pixel even at genome-scale cumBp (the case that used
// to need the split). Screen X is reconstructed as bpRel*inv + panPx, where
// panPx = (base - offsetPx*bpPerPx)*inv — SYNC with syntenyRibbonMarks'
// uniform write / syntenyPickEngine.projectCorners /
// syntenyTypes.computeCorners.
function screenXTop(
  g: ReturnType<typeof buildAt>['g'],
  i: number,
  offsetPx: number,
  bpPerPx: number,
) {
  const inv = 1 / bpPerPx
  return g.bp1[i]! * inv + (g.base0 - offsetPx * bpPerPx) * inv
}

// One 100bp feature at `locusCumBp` on both axes, with the view centered on it.
function buildAt(locusCumBp: number, bpPerPx: number, viewWidth: number) {
  const offsetPx = locusCumBp / bpPerPx - viewWidth / 2
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([locusCumBp]),
    p12_cumBp: new Float64Array([locusCumBp + 100]),
    p21_cumBp: new Float64Array([locusCumBp]),
    p22_cumBp: new Float64Array([locusCumBp + 100]),
    queryGridAnchors: new Float64Array([0]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    cigarMode: 'off',
    bpPerPx0: bpPerPx,
    bpPerPx1: bpPerPx,
    viewOff0: offsetPx,
    viewOff1: offsetPx,
    viewWidth,
    window0: viewportWindow({
      viewOff: offsetPx,
      viewWidth,
      bpPerPx,
    }),
    window1: viewportWindow({
      viewOff: offsetPx,
      viewWidth,
      bpPerPx,
    }),
  })
  return { g, offsetPx }
}

test('on-screen corner at genome scale is stored window-relative + sub-pixel', () => {
  const locus = 1.5e9 // deep in a large genome (past Float32 exact-int)
  const W = 1000
  const { g, offsetPx } = buildAt(locus, 1, W)
  // Stored corner is small-magnitude (window-relative), hence Float32-exact —
  // the base subtraction happened at emit. A raw cumBp here would be ~1.5e9.
  expect(Math.abs(g.bp1[0]!)).toBeLessThan(W * 2)
  // Reconstructs to the true screen X (locus centered → W/2).
  expect(screenXTop(g, 0, offsetPx, 1)).toBeCloseTo(W / 2, 2)
})

test('geometry fetched at one zoom projects correctly at another (no refetch)', () => {
  // Fetched centered at bpPerPx=10; the base is tied to that fetch view. When
  // the view zooms to bpPerPx=1 WITHOUT a refetch, the same window-relative
  // corner + a recomputed panPx must still land on the true screen X.
  const locus = 1.5e9
  const W = 1000
  const { g } = buildAt(locus, 10, W)
  const curBpPerPx = 1
  const curOffsetPx = locus / curBpPerPx - W / 2 // view re-centered on locus
  expect(screenXTop(g, 0, curOffsetPx, curBpPerPx)).toBeCloseTo(W / 2, 1)
})
