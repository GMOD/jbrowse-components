import { SimpleFeature } from '@jbrowse/core/util'

import { defaultFilterFlags } from '../shared/util.ts'
import { filterChainFeatures } from './executeRenderAlignmentData.ts'

import type { FilterBy } from '../shared/types.ts'

const PROPER_PAIR = 0x2
const SUPPLEMENTARY = 0x800

// The flag masks are required on FilterBy and irrelevant here — the adapters
// apply those, not this function. Only the categories vary per test.
function filt(categories: Partial<FilterBy> = {}): FilterBy {
  return { ...defaultFilterFlags, ...categories }
}

// A two-read chain sharing one QNAME with the given orientation/flags.
function pair(name: string, orientation: string, flags: number) {
  return [
    new SimpleFeature({
      uniqueId: `${name}-1`,
      refName: 'ctgA',
      start: 0,
      end: 100,
      name,
      flags,
      pair_orientation: orientation,
    }),
    new SimpleFeature({
      uniqueId: `${name}-2`,
      refName: 'ctgA',
      start: 300,
      end: 400,
      name,
      flags,
      pair_orientation: orientation,
    }),
  ]
}

function names(features: { get: (k: string) => unknown }[]) {
  return [...new Set(features.map(f => f.get('name') as string))].sort()
}

describe('filterChainFeatures properPairs', () => {
  test('"exclude" hides concordant FR proper pairs', () => {
    const features = pair('proper', 'F1R2', PROPER_PAIR)
    expect(
      filterChainFeatures(features, filt({ properPairs: 'exclude' })),
    ).toHaveLength(0)
  })

  test('"exclude" keeps discordant RR/LL/RL pairs even when flagged proper', () => {
    const features = [
      ...pair('rr', 'F1F2', PROPER_PAIR),
      ...pair('ll', 'R1R2', PROPER_PAIR),
      ...pair('rl', 'R1F2', PROPER_PAIR),
      ...pair('proper', 'F1R2', PROPER_PAIR),
    ]
    expect(
      names(filterChainFeatures(features, filt({ properPairs: 'exclude' }))),
    ).toEqual(['ll', 'rl', 'rr'])
  })

  // The inverse of the test above, and the state the old `drawProperPairs`
  // boolean could not express at all.
  test('"only" keeps the concordant pairs and drops the discordant ones', () => {
    const features = [
      ...pair('rr', 'F1F2', PROPER_PAIR),
      ...pair('proper', 'F1R2', PROPER_PAIR),
    ]
    expect(
      names(filterChainFeatures(features, filt({ properPairs: 'only' }))),
    ).toEqual(['proper'])
  })

  test('"exclude" keeps pairs missing the proper-pair flag', () => {
    const features = pair('noflag', 'F1R2', 0)
    expect(
      names(filterChainFeatures(features, filt({ properPairs: 'exclude' }))),
    ).toEqual(['noflag'])
  })

  test('"exclude" keeps proper pairs carrying a supplementary (chimeric) segment', () => {
    // BWA-MEM propagates the 0x2 flag onto supplementary records, so a proper
    // FR pair with a split segment is genuine SV evidence that must stay visible
    const chain = [
      ...pair('chimeric', 'F1R2', PROPER_PAIR),
      new SimpleFeature({
        uniqueId: 'chimeric-supp',
        refName: 'ctgA',
        start: 5000,
        end: 5100,
        name: 'chimeric',
        flags: PROPER_PAIR | SUPPLEMENTARY,
        pair_orientation: 'F1R2',
      }),
    ]
    expect(
      names(filterChainFeatures(chain, filt({ properPairs: 'exclude' }))),
    ).toEqual(['chimeric'])
  })

  test('keeps everything when the category is absent', () => {
    const features = pair('proper', 'F1R2', PROPER_PAIR)
    expect(filterChainFeatures(features, filt())).toHaveLength(2)
  })
})

describe('filterChainFeatures split', () => {
  test('"only" hides chains with no supplementary segment', () => {
    const features = pair('plain', 'F1R2', 0)
    expect(filterChainFeatures(features, filt({ split: 'only' }))).toHaveLength(
      0,
    )
  })

  test('"only" keeps chains containing a supplementary segment', () => {
    const chain = [
      ...pair('chimeric', 'F1R2', PROPER_PAIR),
      new SimpleFeature({
        uniqueId: 'chimeric-supp',
        refName: 'ctgA',
        start: 5000,
        end: 5100,
        name: 'chimeric',
        flags: SUPPLEMENTARY,
        pair_orientation: 'F1R2',
      }),
    ]
    expect(names(filterChainFeatures(chain, filt({ split: 'only' })))).toEqual([
      'chimeric',
    ])
  })

  test('"only" keeps a primary whose SA tag names an off-screen supplementary', () => {
    // Only the primary is in view (its supplementary maps outside the fetched
    // region), so no on-screen member carries the supplementary flag — but the
    // SA tag proves the read is split, so it must survive "only split".
    const features = [
      new SimpleFeature({
        uniqueId: 'saonly-1',
        refName: 'ctgA',
        start: 0,
        end: 100,
        name: 'saonly',
        flags: 0,
        pair_orientation: 'F1R2',
        tags: { SA: 'ctgB,5000,+,50S50M,60,0;' },
      }),
    ]
    expect(
      names(filterChainFeatures(features, filt({ split: 'only' }))),
    ).toEqual(['saonly'])
  })

  // The state the old `showOnlySplitAlignments` boolean could not express:
  // hiding the breakpoint evidence to read the background pileup on its own.
  test('"exclude" drops the split chains and keeps the plain ones', () => {
    const chain = [
      ...pair('plain', 'F1R2', 0),
      ...pair('chimeric', 'F1R2', PROPER_PAIR),
      new SimpleFeature({
        uniqueId: 'chimeric-supp',
        refName: 'ctgA',
        start: 5000,
        end: 5100,
        name: 'chimeric',
        flags: SUPPLEMENTARY,
        pair_orientation: 'F1R2',
      }),
    ]
    expect(
      names(filterChainFeatures(chain, filt({ split: 'exclude' }))),
    ).toEqual(['plain'])
  })

  test('keeps everything when the category is absent', () => {
    const features = pair('plain', 'F1R2', 0)
    expect(filterChainFeatures(features, filt())).toHaveLength(2)
  })
})

describe('filterChainFeatures singletons', () => {
  const lone = new SimpleFeature({
    uniqueId: 'lone-1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    name: 'lone',
    flags: 0,
    pair_orientation: 'F1R2',
  })

  test('"exclude" drops chains of one and keeps the paired ones', () => {
    const features = [lone, ...pair('mated', 'F1R2', 0)]
    expect(
      names(filterChainFeatures(features, filt({ singletons: 'exclude' }))),
    ).toEqual(['mated'])
  })

  test('"only" keeps the chains of one', () => {
    const features = [lone, ...pair('mated', 'F1R2', 0)]
    expect(
      names(filterChainFeatures(features, filt({ singletons: 'only' }))),
    ).toEqual(['lone'])
  })
})

// Every category is AND-ed: this is the SV export, the split reads of the pairs
// the aligner did not call concordant.
//
// Both split chains are split via the SA tag rather than a supplementary
// record, because a supplementary is never concordant (`isConcordantPairRead`)
// and so a chain carrying one is not a proper-pair chain whatever its flags —
// which would make `properPairs: 'exclude'` keep both and prove nothing about
// the AND.
test('filterChainFeatures ANDs the categories', () => {
  const splitVia = (name: string, orientation: string) =>
    pair(name, orientation, PROPER_PAIR).map(
      f =>
        new SimpleFeature({
          ...f.toJSON(),
          tags: { SA: 'ctgB,5000,+,50S50M,60,0;' },
        }),
    )
  const features = [
    ...splitVia('splitProper', 'F1R2'),
    ...splitVia('splitDiscordant', 'F1F2'),
    ...pair('plainDiscordant', 'F1F2', PROPER_PAIR),
  ]
  // split:only drops plainDiscordant; properPairs:exclude drops splitProper
  expect(
    names(
      filterChainFeatures(
        features,
        filt({ split: 'only', properPairs: 'exclude' }),
      ),
    ),
  ).toEqual(['splitDiscordant'])
})

describe('filterChainFeatures dedup guard', () => {
  test('collapses records sharing an id (duplicate index-chunk emit)', () => {
    const [a, b] = pair('dup', 'F1R2', 0)
    // b reuses a's uniqueId → same id(); guard must drop the second
    const dup = new SimpleFeature({ ...b!.toJSON(), uniqueId: a!.id() })
    const out = filterChainFeatures([a!, dup], filt())
    expect(out).toHaveLength(1)
  })

  test('returns the input array unchanged when there are no duplicates', () => {
    const features = pair('uniq', 'F1R2', 0)
    // no-dup fast path: same reference back, no copy
    expect(filterChainFeatures(features, filt())).toBe(features)
  })
})
