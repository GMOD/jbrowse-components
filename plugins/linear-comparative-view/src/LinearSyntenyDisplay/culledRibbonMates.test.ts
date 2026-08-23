import { culledRibbonMateData } from './culledRibbonMates.ts'

import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// Instances as the geometry stage emits them: window-relative bp per axis,
// several per feature once a CIGAR is drawn, and the feature each belongs to.
function geometry(
  instances: [
    feature: number,
    q1: number,
    q2: number,
    m1: number,
    m2: number,
  ][],
  { base0 = 0, base1 = 0, lengths = instances.map(() => 1000) } = {},
): SyntenyGeometry {
  return {
    bp1: Float32Array.from(instances.map(i => i[1])),
    bp2: Float32Array.from(instances.map(i => i[2])),
    bp3: Float32Array.from(instances.map(i => i[3])),
    bp4: Float32Array.from(instances.map(i => i[4])),
    base0,
    base1,
    kinds: new Uint8Array(instances.length),
    instanceFeatureIdx: Uint32Array.from(instances.map(i => i[0])),
    alignmentLengths: Float32Array.from(lengths),
    instanceCount: instances.length,
  }
}

function features(names: string[]) {
  const dict = [...new Set(names)]
  return {
    mateRefNameDict: dict,
    mateRefNameIds: Uint32Array.from(names, n => dict.indexOf(n)),
    mateStarts: Uint32Array.from(names, (_, i) => i * 10),
    mateEnds: Uint32Array.from(names, (_, i) => i * 10 + 5),
  }
}

// The corners the RENDERER projects, not the adapter's coordinates: a
// CIGAR-clipped block draws from endpoints the projection loop moved, so a mark
// reprojected from the feature lanes would sit beside its own ribbon.
test('a feature is placed on both axes, in absolute cumBp', () => {
  const out = culledRibbonMateData(
    geometry([[0, 100, 400, 7000, 7300]], { base0: 1_000_000, base1: 5_000 }),
    features(['ctgB']),
  )
  expect([...out.starts]).toEqual([1_000_100])
  expect([...out.ends]).toEqual([1_000_400])
  expect([...out.mateAxis.starts]).toEqual([12_000])
  expect([...out.mateAxis.ends]).toEqual([12_300])
})

// Transparent-CIGAR mode replaces the full-span trapezoid with one tile per
// match segment, so no single instance spans the block. Reading one of them
// would mark a fragment of the alignment and label the gaps as drawn.
test('a feature spread over several instances takes their union', () => {
  const out = culledRibbonMateData(
    geometry([
      [0, 300, 400, 7200, 7300],
      [0, 100, 200, 7000, 7100],
    ]),
    features(['ctgB']),
  )
  expect([...out.starts]).toEqual([100])
  expect([...out.ends]).toEqual([400])
  expect([...out.mateAxis.starts]).toEqual([7000])
  expect([...out.mateAxis.ends]).toEqual([7300])
})

// A reversed alignment's corners arrive high-to-low, and a span read in that
// order is outside every band there is.
test('corner order does not decide the span', () => {
  const out = culledRibbonMateData(
    geometry([[0, 400, 100, 7300, 7000]]),
    features(['ctgB']),
  )
  expect([...out.starts]).toEqual([100])
  expect([...out.mateAxis.ends]).toEqual([7300])
})

// What lets a lane drop out of the strip on two comparisons rather than a walk:
// a facing row whose band already spans every mate this fetch holds is hiding
// none of them, which is what two rows zoomed out over each other are.
test('the extent is the whole fetch, so a covering band can skip it', () => {
  const out = culledRibbonMateData(
    geometry([
      [0, 100, 200, 7000, 7100],
      [1, 300, 400, 90_000, 90_100],
    ]),
    features(['ctgB', 'ctgC']),
  )
  expect(out.mateAxis.lo).toBe(7000)
  expect(out.mateAxis.hi).toBe(90_100)
})

// The tooltip's number, and the same question the worker's tally answers for
// the other class: how many alignments on this band go to that contig.
test('counts are per contig over the whole fetch', () => {
  const out = culledRibbonMateData(
    geometry([
      [0, 100, 200, 7000, 7100],
      [1, 300, 400, 8000, 8100],
      [2, 500, 600, 9000, 9100],
    ]),
    features(['ctgB', 'ctgC', 'ctgB']),
  )
  expect(out.mateRefNameDict).toEqual(['ctgB', 'ctgC'])
  expect([...out.counts]).toEqual([2, 1])
})

// A feature whose instances were all emitted off-screen keeps a span that reads
// as empty, which the layout's own x test drops — rather than a zero-width one
// at cumBp 0, which is a mark at the far left of the axis.
test('a feature with no instances keeps an empty span', () => {
  const out = culledRibbonMateData(
    geometry([[1, 100, 200, 7000, 7100]]),
    features(['ctgB', 'ctgC']),
  )
  expect(out.starts[0]! > out.ends[0]!).toBe(true)
})
