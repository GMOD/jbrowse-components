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

// Both sides of the fetch's per-feature lanes: `names` are the contigs on the
// facing axis, `own` the ones this row is anchored on.
function features(names: string[], own = names.map(() => 'ctgA')) {
  const dict = [...new Set(names)]
  const ownDict = [...new Set(own)]
  return {
    refNameDict: ownDict,
    refNameIds: Uint32Array.from(own, n => ownDict.indexOf(n)),
    starts: Uint32Array.from(names, (_, i) => i * 100),
    ends: Uint32Array.from(names, (_, i) => i * 100 + 50),
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
  const { onQueryAxis: out } = culledRibbonMateData(
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
  const { onQueryAxis: out } = culledRibbonMateData(
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
  const { onQueryAxis: out } = culledRibbonMateData(
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
  const { onQueryAxis: out } = culledRibbonMateData(
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
  const { onQueryAxis: out } = culledRibbonMateData(
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
  const { onQueryAxis: out } = culledRibbonMateData(
    geometry([[1, 100, 200, 7000, 7100]]),
    features(['ctgB', 'ctgC']),
  )
  expect(out.starts[0]! > out.ends[0]!).toBe(true)
})

// The transpose, and the whole of what the second row was missing: culling drops
// a ribbon when EITHER end leaves its row's band, so the undrawable alignment
// whose target end is in plain sight has to be marked down there. Placed on the
// target axis, band-tested against the query one, and named with the contig the
// row above has scrolled off.
test('the target perspective swaps the two axes over', () => {
  const { onQueryAxis, onTargetAxis } = culledRibbonMateData(
    geometry([[0, 100, 400, 7000, 7300]], { base0: 1_000_000, base1: 5_000 }),
    features(['ctgB'], ['ctgA']),
  )
  expect([...onTargetAxis.starts]).toEqual([12_000])
  expect([...onTargetAxis.ends]).toEqual([12_300])
  expect([...onTargetAxis.mateAxis.starts]).toEqual([1_000_100])
  expect([...onTargetAxis.mateAxis.ends]).toEqual([1_000_400])
  expect(onTargetAxis.mateAxis.lo).toBe(onQueryAxis.starts[0])
  expect(onTargetAxis.mateAxis.hi).toBe(onQueryAxis.ends[0])
})

// A bottom mark names a contig of the QUERY assembly — the one the row above is
// not showing right now — where a top mark names the target's. Sharing one
// dictionary would label the second row's marks with the first row's contigs,
// which on two haplotypes of one genome is a picture nothing disagrees with.
test('each perspective names the contigs on the far side of the band', () => {
  const { onQueryAxis, onTargetAxis } = culledRibbonMateData(
    geometry([
      [0, 100, 200, 7000, 7100],
      [1, 300, 400, 8000, 8100],
    ]),
    features(['ctgB', 'ctgC'], ['ctgA', 'ctgA']),
  )
  expect(onQueryAxis.mateRefNameDict).toEqual(['ctgB', 'ctgC'])
  expect(onTargetAxis.mateRefNameDict).toEqual(['ctgA'])
  expect([...onTargetAxis.counts]).toEqual([2])
})

// The click's locus, in the named contig's own bp: the query lanes for the
// target strip and the mate lanes for the query strip. Reading the cumBp
// placements instead would navigate the row above to an offset in a whole-genome
// ruler nothing on that row is measured against.
test('the locus a mark navigates to comes from the lane that names it', () => {
  const { onQueryAxis, onTargetAxis } = culledRibbonMateData(
    geometry([[0, 100, 200, 7000, 7100]]),
    features(['ctgB']),
  )
  expect(Array.from(onQueryAxis.mateStarts)).toEqual([0])
  expect(Array.from(onQueryAxis.mateEnds)).toEqual([5])
  expect(Array.from(onTargetAxis.mateStarts)).toEqual([0])
  expect(Array.from(onTargetAxis.mateEnds)).toEqual([50])
})

// Both perspectives read the same sentinel, so a feature drawn nowhere is a mark
// nowhere rather than a mark at cumBp 0 on the axis that was not tested.
test('a feature with no instances is empty on both axes', () => {
  const { onQueryAxis, onTargetAxis } = culledRibbonMateData(
    geometry([[1, 100, 200, 7000, 7100]]),
    features(['ctgB', 'ctgC']),
  )
  expect(onQueryAxis.starts[0]! > onQueryAxis.ends[0]!).toBe(true)
  expect(onTargetAxis.starts[0]! > onTargetAxis.ends[0]!).toBe(true)
})
