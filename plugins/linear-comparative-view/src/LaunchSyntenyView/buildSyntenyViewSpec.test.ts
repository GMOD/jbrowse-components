import { SimpleFeature } from '@jbrowse/core/util'

import { buildSyntenyViewSpec } from './buildSyntenyViewSpec.ts'

// A PAF block on ctgA 1000-2000 (interbase) against ctgB 5000-6000 on the mate
// assembly, with a CIGAR carrying one 10bp deletion 100bp in.
function makeFeature({
  strand = 1,
  CIGAR = '1000=',
  mateAssembly = 'volvox2',
  mateRefName = 'ctgB',
  mateStart = 5000,
  mateEnd = 6000,
}: {
  strand?: number
  CIGAR?: string
  mateAssembly?: string
  mateRefName?: string
  mateStart?: number
  mateEnd?: number
} = {}) {
  return new SimpleFeature({
    uniqueId: `f1-${mateAssembly}`,
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 1000,
    end: 2000,
    strand,
    CIGAR,
    mate: {
      assemblyName: mateAssembly,
      refName: mateRefName,
      start: mateStart,
      end: mateEnd,
    },
  })
}

function locs(spec: ReturnType<typeof buildSyntenyViewSpec>) {
  return spec.init.views.map(v => v.loc)
}

test('whole-block launch emits 1-based inclusive locstrings', () => {
  // interbase 1000-2000 is 1-based 1001..2000; emitting the raw interbase start
  // would open the view one base to the left of the alignment
  expect(
    locs(
      buildSyntenyViewSpec({
        features: [makeFeature()],
        windowSize: 0,
        trackId: 't1',
        anchorAssembly: 'volvox',
        flipReversedMates: false,
      }),
    ),
  ).toEqual(['ctgA:1,001..2,000', 'ctgB:5,001..6,000'])
})

test('window size pads both sides, clamped at the start of the contig', () => {
  const spec = buildSyntenyViewSpec({
    features: [makeFeature()],
    windowSize: 1500,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(locs(spec)).toEqual(['ctgA:1..3,500', 'ctgB:3,501..7,500'])
})

test('assemblies and the track come through for the two rows', () => {
  const spec = buildSyntenyViewSpec({
    features: [makeFeature()],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(spec.init.views.map(v => v.assembly)).toEqual(['volvox', 'volvox2'])
  expect(spec.init.tracks).toEqual([['t1']])
})

test('horizontal flip marks the mate row reversed', () => {
  expect(
    locs(
      buildSyntenyViewSpec({
        features: [makeFeature({ strand: -1 })],
        windowSize: 0,
        trackId: 't1',
        anchorAssembly: 'volvox',
        flipReversedMates: true,
      }),
    )[1],
  ).toBe('ctgB:5,001..6,000[rev]')
})

test('a region of interest narrows both axes through the CIGAR', () => {
  // 100 matches, a 10bp deletion (feature axis only), then matches. Asking for
  // feature 1200-1400 walks to mate offsets 190-390 off mate.start.
  const spec = buildSyntenyViewSpec({
    features: [makeFeature({ CIGAR: '100=10D890=' })],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    region: { start: 1200, end: 1400 },
    flipReversedMates: false,
  })
  expect(locs(spec)).toEqual(['ctgA:1,201..1,400', 'ctgB:5,191..5,390'])
})

test('a reverse-strand region of interest walks the mate axis backwards', () => {
  // same offsets, but the mate is entered at mate.end and counted down:
  // 6000-190=5810 down to 6000-390=5610
  const spec = buildSyntenyViewSpec({
    features: [makeFeature({ strand: -1, CIGAR: '100=10D890=' })],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    region: { start: 1200, end: 1400 },
    flipReversedMates: false,
  })
  expect(locs(spec)).toEqual(['ctgA:1,201..1,400', 'ctgB:5,611..5,810'])
})

test('a region wider than the block clips to the block', () => {
  expect(
    locs(
      buildSyntenyViewSpec({
        features: [makeFeature()],
        windowSize: 0,
        trackId: 't1',
        anchorAssembly: 'volvox',
        region: { start: 0, end: 100000 },
        flipReversedMates: false,
      }),
    ),
  ).toEqual(['ctgA:1,001..2,000', 'ctgB:5,001..6,000'])
})

// A degenerate mapping (region collapsing onto the block's first base) must
// still assemble into a forward locstring — `ctgA:1001..1000` would parse into
// an inverted range.
test('a zero-width mapping still spans at least one base', () => {
  expect(
    locs(
      buildSyntenyViewSpec({
        features: [makeFeature()],
        windowSize: 0,
        trackId: 't1',
        anchorAssembly: 'volvox',
        region: { start: 500, end: 1000 },
        flipReversedMates: false,
      }),
    ),
  ).toEqual(['ctgA:1,001', 'ctgB:5,001'])
})

test('no CIGAR (coarse tier) ignores the region and uses the whole block', () => {
  expect(
    locs(
      buildSyntenyViewSpec({
        features: [
          new SimpleFeature({
            uniqueId: 'f1',
            assemblyName: 'volvox',
            refName: 'ctgA',
            start: 1000,
            end: 2000,
            strand: 1,
            mate: {
              assemblyName: 'volvox2',
              refName: 'ctgB',
              start: 5000,
              end: 6000,
            },
          }),
        ],
        windowSize: 0,
        trackId: 't1',
        anchorAssembly: 'volvox',
        region: { start: 1200, end: 1400 },
        flipReversedMates: false,
      }),
    ),
  ).toEqual(['ctgA:1,001..2,000', 'ctgB:5,001..6,000'])
})

// The multi-way launch: one anchor panel plus one panel per mate at the locus,
// with a synteny strip in every gap. The same trackId serves every level — the
// view hands each level's two assemblies to the adapter, which is how an
// all-vs-all track resolves the pair.
test('several mates at one locus become one panel each', () => {
  const spec = buildSyntenyViewSpec({
    features: [
      makeFeature({ mateAssembly: 'volvox2' }),
      makeFeature({ mateAssembly: 'volvox3', mateRefName: 'ctgC' }),
      makeFeature({ mateAssembly: 'volvox4', mateRefName: 'ctgD' }),
    ],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(spec.init.views.map(v => v.assembly)).toEqual([
    'volvox',
    'volvox2',
    'volvox3',
    'volvox4',
  ])
  expect(spec.init.tracks).toEqual([['t1'], ['t1'], ['t1']])
})

test('only the mates on the minus strand open reversed', () => {
  expect(
    locs(
      buildSyntenyViewSpec({
        features: [
          makeFeature({ mateAssembly: 'volvox2' }),
          makeFeature({ mateAssembly: 'volvox3', strand: -1 }),
        ],
        windowSize: 0,
        trackId: 't1',
        anchorAssembly: 'volvox',
        flipReversedMates: true,
      }),
    ),
  ).toEqual([
    'ctgA:1,001..2,000',
    'ctgB:5,001..6,000',
    'ctgB:5,001..6,000[rev]',
  ])
})

// Each mate is clipped through its own CIGAR, so one can stop short of the
// region where another covers it; the anchor row has to span both.
test('the anchor row spans the union of what the mates resolved to', () => {
  const spec = buildSyntenyViewSpec({
    features: [
      makeFeature({ CIGAR: '150=850=' }),
      makeFeature({ mateAssembly: 'volvox3', CIGAR: '100=' }),
    ],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    region: { start: 1000, end: 1400 },
    flipReversedMates: false,
  })
  // the second mate's CIGAR runs out at feature offset 100, the first's covers
  // the whole 400bp region
  expect(locs(spec)).toEqual([
    'ctgA:1,001..1,400',
    'ctgB:5,001..5,400',
    'ctgB:5,001..5,100',
  ])
})

test('the anchor panel uses the passed assembly, not the feature field', () => {
  const spec = buildSyntenyViewSpec({
    features: [makeFeature()],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox_alias',
    flipReversedMates: false,
  })
  expect(spec.init.views[0]!.assembly).toBe('volvox_alias')
})
