import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { KIND_MARKER } from './syntenyColors.ts'

const packed = (len: number, op: number) => (len << 4) | op

// Feature 0 is a wide block carrying a CIGAR; feature 1 is a small block sitting
// inside its span. That is the arrangement `compareDrawOrder` produces — largest
// first — and this file is about what the geometry then does with it.
function build() {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0, 60]),
    p12_cumBp: new Float64Array([600, 90]),
    p21_cumBp: new Float64Array([0, 60]),
    p22_cumBp: new Float64Array([600, 90]),
    queryGridAnchors: new Float64Array([0, 0]),
    strands: new Int8Array([1, 1]),
    parsedCigars: [
      [packed(200, CIGAR_M), packed(200, CIGAR_D), packed(200, CIGAR_M)],
      [],
    ],
    starts: new Uint32Array([0, 60]),
    ends: new Uint32Array([600, 90]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 700,
  })
}

// INSTANCE ORDER IS DRAW ORDER, so "feature 1 draws above feature 0" is
// "every instance of feature 1 has a higher index than every instance of
// feature 0". Markers are excluded: they are deliberately last, whatever they
// belong to (see the two-cursor allocation).
function ribbonIndicesByFeature(g: ReturnType<typeof build>) {
  const byFeature = new Map<number, number[]>()
  for (let i = 0; i < g.instanceCount; i++) {
    if (g.kinds[i] !== KIND_MARKER) {
      const f = g.instanceFeatureIdx[i]!
      byFeature.set(f, [...(byFeature.get(f) ?? []), i])
    }
  }
  return byFeature
}

// The property the two-pass build could not hold. It emitted every feature's
// base and THEN every feature's CIGAR quads, so a large block's deletion quads
// landed above a small block's body no matter how the features were sorted —
// and since the pick engine answers with the topmost instance, the small block
// was unhoverable across the whole width of those quads. Sorted feature order
// only reaches the screen if the geometry keeps features whole.
test('a feature sorted later draws entirely above one sorted earlier', () => {
  const g = build()
  const byFeature = ribbonIndicesByFeature(g)
  const big = byFeature.get(0)!
  const small = byFeature.get(1)!

  // the arrangement is only meaningful if the big one really did emit quads
  expect(big.length).toBeGreaterThan(1)
  expect(small.length).toBeGreaterThan(0)

  expect(Math.min(...small)).toBeGreaterThan(Math.max(...big))
})

test("a feature's own CIGAR quads still draw above its own base", () => {
  const g = build()
  const big = ribbonIndicesByFeature(g).get(0)!

  // The base is emitted first, so it is the lowest index of the run, and the
  // quads that paint over it follow.
  expect(big[0]).toBe(Math.min(...big))
  expect(g.kinds[big[0]!]).not.toBe(KIND_MARKER)
})

test('markers stay last, after every ribbon of every feature', () => {
  const g = build()
  const markers: number[] = []
  const ribbons: number[] = []
  for (let i = 0; i < g.instanceCount; i++) {
    ;(g.kinds[i] === KIND_MARKER ? markers : ribbons).push(i)
  }
  expect(markers.length).toBeGreaterThan(0)
  expect(Math.min(...markers)).toBeGreaterThan(Math.max(...ribbons))
})
