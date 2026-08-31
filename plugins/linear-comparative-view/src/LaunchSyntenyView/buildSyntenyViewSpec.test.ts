import { SimpleFeature, assembleLocString } from '@jbrowse/core/util'

import { buildSyntenyViewSpec } from './buildSyntenyViewSpec.ts'
import { resolveFeaturePanels, resolvePanel } from './resolvePanel.ts'

import type { BuildSyntenyViewSpecArgs } from './buildSyntenyViewSpec.ts'
import type { RegionOfInterest } from './resolvePanel.ts'
import type { Feature } from '@jbrowse/core/util'

// A PAF block on ctgA 1000-2000 (interbase) against ctgB 5000-6000 on the mate
// assembly, with a CIGAR carrying one 10bp deletion 100bp in.
function makeFeature({
  strand = 1,
  CIGAR = '1000=',
  start = 1000,
  end = 2000,
  mateAssembly = 'volvox2',
  mateRefName = 'ctgB',
  mateStart = 5000,
  mateEnd = 6000,
}: {
  strand?: number
  CIGAR?: string
  start?: number
  end?: number
  mateAssembly?: string
  mateRefName?: string
  mateStart?: number
  mateEnd?: number
} = {}) {
  return new SimpleFeature({
    uniqueId: `f1-${mateAssembly}-${start}`,
    assemblyName: 'volvox',
    refName: 'ctgA',
    start,
    end,
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

// The launch as a caller holding alignments sees it (the pairwise right-click,
// the feature-detail link): resolve them into panels, then build. Every
// alignment here is on ctgA, which is what makes that the anchor's contig.
function buildFrom({
  features,
  region,
  ...rest
}: Omit<BuildSyntenyViewSpecArgs, 'panels' | 'anchorRefName'> & {
  features: Feature[]
  region?: RegionOfInterest
}) {
  return buildSyntenyViewSpec({
    ...rest,
    anchorRefName: 'ctgA',
    panels: resolveFeaturePanels(features, region),
  })
}

function locs(built: ReturnType<typeof buildSyntenyViewSpec>) {
  return built.views.map(v => v.loc)
}

test('whole-block launch emits 1-based inclusive locstrings', () => {
  // interbase 1000-2000 is 1-based 1001..2000; emitting the raw interbase start
  // would open the view one base to the left of the alignment
  expect(
    locs(
      buildFrom({
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
  const spec = buildFrom({
    features: [makeFeature()],
    windowSize: 1500,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(locs(spec)).toEqual(['ctgA:1..3,500', 'ctgB:3,501..7,500'])
})

test('assemblies and the track come through for the two rows', () => {
  const spec = buildFrom({
    features: [makeFeature()],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(spec.views.map(v => v.assembly)).toEqual(['volvox', 'volvox2'])
  expect(spec.tracks).toEqual([['t1']])
})

test('horizontal flip marks the mate row reversed', () => {
  expect(
    locs(
      buildFrom({
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
  const spec = buildFrom({
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
  const spec = buildFrom({
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
      buildFrom({
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
      buildFrom({
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

// A block with no CIGAR (a PAF written without minimap2's `-c`, MashMap, MCScan,
// the coarse PIF tier) is drawn as a straight ribbon between its two corners, so
// the region maps onto it by interpolation — the same answer the picture gives.
// Framing on the whole block instead ignored the selection outright.
describe('no CIGAR', () => {
  function noCigarFeature({
    strand = 1,
    mateStart = 5000,
    mateEnd = 6000,
  }: { strand?: number; mateStart?: number; mateEnd?: number } = {}) {
    return new SimpleFeature({
      uniqueId: 'f1',
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 1000,
      end: 2000,
      strand,
      mate: {
        assemblyName: 'volvox2',
        refName: 'ctgB',
        start: mateStart,
        end: mateEnd,
      },
    })
  }

  const args = {
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  }

  test('the region maps onto the block proportionally', () => {
    // 1200-1400 is 20%-40% along a 1000bp block, and the mate is half as long,
    // so it lands 100-200bp into a mate that starts at 5000
    expect(
      locs(
        buildFrom({
          ...args,
          features: [noCigarFeature({ mateEnd: 5500 })],
          region: { start: 1200, end: 1400 },
        }),
      ),
    ).toEqual(['ctgA:1,201..1,400', 'ctgB:5,101..5,200'])
  })

  test('a reverse-strand block interpolates from the mate end backwards', () => {
    expect(
      locs(
        buildFrom({
          ...args,
          features: [noCigarFeature({ strand: -1, mateEnd: 5500 })],
          region: { start: 1200, end: 1400 },
        }),
      ),
    ).toEqual(['ctgA:1,201..1,400', 'ctgB:5,301..5,400'])
  })

  test('a region wider than the block still uses the whole block', () => {
    expect(
      locs(
        buildFrom({
          ...args,
          features: [noCigarFeature()],
          region: { start: 0, end: 100000 },
        }),
      ),
    ).toEqual(['ctgA:1,001..2,000', 'ctgB:5,001..6,000'])
  })

  test('no region at all is still the whole block', () => {
    expect(locs(buildFrom({ ...args, features: [noCigarFeature()] }))).toEqual([
      'ctgA:1,001..2,000',
      'ctgB:5,001..6,000',
    ])
  })

  // Interpolation lands on fractional bases, and the dialog previews the span
  // `resolvePanel` reports while the launch pads it — so the two round the same
  // way, outward, or the view opens a base short of the row it was read off.
  test('the launched panel is the span the dialog previewed', () => {
    const features = [noCigarFeature({ mateEnd: 5333 })]
    const region = { start: 1200, end: 1400 }
    const panel = resolvePanel(features, region)!
    expect([panel.mateStart, panel.mateEnd]).toEqual([5066, 5134])
    expect(locs(buildFrom({ ...args, features, region }))[1]).toBe(
      assembleLocString({
        refName: panel.refName,
        start: panel.mateStart,
        end: panel.mateEnd,
      }),
    )
  })
})

// The multi-way launch: one anchor panel plus one panel per mate at the locus,
// with a synteny strip in every gap. The same trackId serves every level — the
// view hands each level's two assemblies to the adapter, which is how an
// all-vs-all track resolves the pair.
test('several mates at one locus become one panel each', () => {
  const spec = buildFrom({
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
  expect(spec.views.map(v => v.assembly)).toEqual([
    'volvox',
    'volvox2',
    'volvox3',
    'volvox4',
  ])
  expect(spec.tracks).toEqual([['t1'], ['t1'], ['t1']])
})

// A band is drawn between adjacent panels only, so on a reference-anchored
// dataset the anchor's position decides how many bands are direct pairs: on top
// only the first is, in the middle the two either side of it are. Same panel
// count and same level count either way.
test('the anchor opens where the dialog put it', () => {
  const spec = buildFrom({
    features: [
      makeFeature({ mateAssembly: 'volvox2' }),
      makeFeature({ mateAssembly: 'volvox3', mateRefName: 'ctgC' }),
    ],
    anchorIndex: 1,
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(spec.views.map(v => v.assembly)).toEqual([
    'volvox2',
    'volvox',
    'volvox3',
  ])
  expect(spec.tracks).toEqual([['t1'], ['t1']])
})

test('an anchor index past the last mate puts it at the bottom', () => {
  const spec = buildFrom({
    features: [makeFeature({ mateAssembly: 'volvox2' })],
    anchorIndex: 1,
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  })
  expect(spec.views.map(v => v.assembly)).toEqual(['volvox2', 'volvox'])
})

test('only the mates on the minus strand open reversed', () => {
  expect(
    locs(
      buildFrom({
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
  const spec = buildFrom({
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

// A selection routinely covers several blocks of one mate: an HSP table (BLAST
// tabular) and a gene-anchor table (MCScan) are one row per hit, and a minimap2
// PAF splits at every structural difference. Framing on the widest of them
// opened a fraction of the selection on BOTH axes — the mate panel on one
// block, and the anchor row on that block's slice of the region — and dropped
// the rest with nothing on screen to say so.
describe('several blocks of one mate', () => {
  const region = { start: 1000, end: 5000 }
  const fragments = [
    makeFeature({ start: 1000, end: 2000, mateStart: 5000, mateEnd: 6000 }),
    makeFeature({
      start: 3000,
      end: 5000,
      CIGAR: '2000=',
      mateStart: 7000,
      mateEnd: 9000,
    }),
  ]
  const args = {
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  }

  test('are one panel spanning all of them', () => {
    const spec = buildFrom({ ...args, features: fragments, region })
    expect(locs(spec)).toEqual(['ctgA:1,001..5,000', 'ctgB:5,001..9,000'])
    expect(spec.views.map(v => v.assembly)).toEqual(['volvox', 'volvox2'])
    expect(spec.tracks).toEqual([['t1']])
  })

  // one panel, so a fragmented pairwise launch is still the two-row case the
  // "collapse empty rows" default is about
  test('do not read as a multi-way launch', () => {
    expect(
      buildFrom({ ...args, features: fragments, region }).collapseEmptyRows,
    ).toBe(false)
  })

  // a panel opens on one stable sequence, so a minority contig is dropped
  // rather than unioned into a span covering neither
  test('reaching two mate contigs keep the one covering most of the region', () => {
    const spec = buildFrom({
      ...args,
      region,
      features: [
        ...fragments,
        makeFeature({
          start: 4900,
          end: 5000,
          mateRefName: 'ctgQ',
          mateStart: 100,
          mateEnd: 200,
        }),
      ],
    })
    expect(locs(spec)).toEqual(['ctgA:1,001..5,000', 'ctgB:5,001..9,000'])
  })

  // the flip is a property of the panel, so it follows the strand carrying most
  // of the alignment rather than whichever block was served first
  test('open reversed when the minus strand carries most of the alignment', () => {
    const minusMost = [
      makeFeature({ start: 1000, end: 1100, mateStart: 5000, mateEnd: 5100 }),
      makeFeature({
        start: 2000,
        end: 5000,
        strand: -1,
        CIGAR: '3000=',
        mateStart: 6000,
        mateEnd: 9000,
      }),
    ]
    expect(
      buildFrom({
        ...args,
        region,
        flipReversedMates: true,
        features: minusMost,
      }).views[1]!.loc,
    ).toBe('ctgB:5,001..9,000[rev]')
  })
})

test('the anchor panel uses the passed assembly, not the feature field', () => {
  const spec = buildFrom({
    features: [makeFeature()],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox_alias',
    flipReversedMates: false,
  })
  expect(spec.views[0]!.assembly).toBe('volvox_alias')
})

// The launched panels carry no tracks, so the view opens them as rulers on a
// multi-way launch and leaves a pairwise one expanded. It rides on the init
// rather than being a policy buildViews guesses, so an authored session (which
// never sets it) keeps its rows exactly as written, and the dialog's "Collapse
// panels to rulers" checkbox overrides the default in either direction.
test('multi-way launch collapses empty rows, pairwise does not', () => {
  const args = {
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  }
  const twoMates = [makeFeature(), makeFeature({ mateAssembly: 'volvox3' })]
  expect(buildFrom({ ...args, features: twoMates }).collapseEmptyRows).toBe(
    true,
  )
  expect(
    buildFrom({ ...args, features: [makeFeature()] }).collapseEmptyRows,
  ).toBe(false)
  expect(
    buildFrom({
      ...args,
      features: twoMates,
      collapseEmptyRows: false,
    }).collapseEmptyRows,
  ).toBe(false)
})

// The launching view's tracks land on the anchor panel and nowhere else: the
// mate panels are other assemblies, which the source view says nothing about.
test('anchor tracks go on the anchor panel only, wherever it sits in the stack', () => {
  const args = {
    features: [makeFeature(), makeFeature({ mateAssembly: 'volvox3' })],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
    anchorTracks: [{ trackId: 'genes' }],
  }
  expect(buildFrom(args).views.map(v => v.tracks)).toEqual([
    [{ trackId: 'genes' }],
    undefined,
    undefined,
  ])
  // anchorIndex moves the anchor down the stack; the tracks follow it rather
  // than staying on row 0
  expect(
    buildFrom({ ...args, anchorIndex: 1 }).views.map(v => v.tracks),
  ).toEqual([undefined, [{ trackId: 'genes' }], undefined])
})

// `tracks: []` on a panel would be a different snapshot than no key at all, and
// the launches that pass nothing (or whose dialog checkbox is off) should keep
// producing exactly the view they always did.
test('no anchor tracks leaves the panel without a tracks key', () => {
  const args = {
    features: [makeFeature()],
    windowSize: 0,
    trackId: 't1',
    anchorAssembly: 'volvox',
    flipReversedMates: false,
  }
  expect(buildFrom(args).views[0]).not.toHaveProperty('tracks')
  expect(buildFrom({ ...args, anchorTracks: [] }).views[0]).not.toHaveProperty(
    'tracks',
  )
})

// A whole-chromosome launch against an HSP or gene-anchor table is one row per
// hit, and the discovery fetch behind it is uncapped — so the union over a
// panel's blocks has to be a loop. `Math.min(...blocks)` throws `RangeError:
// Maximum call stack size exceeded` past ~125k arguments, and the mate ends
// alone are two per block, so this used to take the worker out at ~62k blocks
// and report it as a failed RPC.
test('a panel of tens of thousands of blocks unions without overflowing', () => {
  const features = Array.from({ length: 80_000 }, (_, i) =>
    makeFeature({
      CIGAR: '10=',
      start: 1000 + i * 10,
      end: 1010 + i * 10,
      mateStart: 5000 + i * 10,
      mateEnd: 5010 + i * 10,
    }),
  )
  const panel = resolvePanel(features, undefined)!
  expect([panel.anchorStart, panel.anchorEnd]).toEqual([1000, 801_000])
  expect([panel.mateStart, panel.mateEnd]).toEqual([5000, 805_000])
})
