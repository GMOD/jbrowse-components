import { SimpleFeature } from '@jbrowse/core/util'

import { defaultFilterFlags } from '../shared/util.ts'
import { filterChainFeatures } from './filterChainFeatures.ts'

import type { ReadFilter } from '../shared/types.ts'

const PAIRED = 0x1
const PROPER_PAIR = 0x2
const MATE_UNMAPPED = 0x8
const SECONDARY = 0x100
const SUPPLEMENTARY = 0x800

// The flag masks are required on ReadFilter and irrelevant here — the adapters
// apply those, not this function. Only the categories vary per test.
function filt(categories: Partial<ReadFilter> = {}): ReadFilter {
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

describe('filterChainFeatures svSignal', () => {
  const PAIRED_PROPER = PAIRED | PROPER_PAIR
  const only = filt({ svSignal: 'only' })
  const record = (name: string, id: string, fields: Record<string, unknown>) =>
    new SimpleFeature({
      uniqueId: `${name}-${id}`,
      refName: 'ctgA',
      start: 0,
      end: 100,
      name,
      CIGAR: '100M',
      ...fields,
    })

  // A row per line of the spec's table (sv-signal-filter-and-coverage.md)
  const chains = {
    concordant: pair('concordant', 'F1R2', PAIRED_PROPER),
    mateSplit: [
      ...pair('mateSplit', 'F1R2', PAIRED_PROPER).slice(0, 1),
      record('mateSplit', '2', {
        flags: PAIRED_PROPER,
        pair_orientation: 'F1R2',
        CIGAR: '40S60M',
        tags: { SA: 'chr4,5000,+,60S40M,60,0;' },
      }),
    ],
    discordant: pair('discordant', 'R1F2', PAIRED_PROPER),
    unflagged: pair('unflagged', 'F1R2', PAIRED),
    interchrom: [record('interchrom', '1', { flags: PAIRED })],
    mateUnmapped: [
      record('mateUnmapped', '1', { flags: PAIRED | MATE_UNMAPPED }),
    ],
    deletion: [
      record('deletion', '1', {
        flags: PAIRED_PROPER,
        pair_orientation: 'F1R2',
        CIGAR: '50M60D50M',
      }),
      ...pair('deletion', 'F1R2', PAIRED_PROPER).slice(1),
    ],
    insertion: [
      record('insertion', '1', {
        flags: PAIRED_PROPER,
        pair_orientation: 'F1R2',
        CIGAR: '50M60I50M',
      }),
      ...pair('insertion', 'F1R2', PAIRED_PROPER).slice(1),
    ],
    smallIndels: [
      record('smallIndels', '1', {
        flags: PAIRED_PROPER,
        pair_orientation: 'F1R2',
        CIGAR: '50M49D20M49I50M',
      }),
      ...pair('smallIndels', 'F1R2', PAIRED_PROPER).slice(1),
    ],
    secondary: [record('secondary', '1', { flags: PAIRED | SECONDARY })],
    longRead: [record('longRead', '1', { flags: 0, CIGAR: '5000M' })],
    longReadSplit: [
      record('longReadSplit', '1', {
        flags: 0,
        CIGAR: '1000S4000M',
        tags: { SA: 'chr4,5000,+,4000S1000M,60,0;' },
      }),
    ],
    longReadIndel: [
      record('longReadIndel', '1', { flags: 0, CIGAR: '2000M80I3000M' }),
    ],
    syntenyBlock: [record('syntenyBlock', '1', { CIGAR: '100M' })],
    syntenyBlockIndel: [
      record('syntenyBlockIndel', '1', { CIGAR: '100M500D100M' }),
    ],
  }
  const all = Object.values(chains).flat()
  const evidence = [
    'deletion',
    'discordant',
    'insertion',
    'interchrom',
    'longReadIndel',
    'longReadSplit',
    'mateSplit',
    'mateUnmapped',
    'syntenyBlockIndel',
    'unflagged',
  ]

  test('"only" keeps every chain carrying SV evidence, and nothing else', () => {
    expect(names(filterChainFeatures(all, only))).toEqual(evidence)
  })

  test('"exclude" keeps the rest', () => {
    expect(
      names(filterChainFeatures(all, filt({ svSignal: 'exclude' }))),
    ).toEqual(
      Object.keys(chains)
        .filter(n => !evidence.includes(n))
        .sort(),
    )
  })

  // The chain-wide judgement: the mate of a split read, or of a read carrying
  // an SV-size deletion, comes with it whatever its own flags
  test('"only" keeps the concordant mate of an evidence read', () => {
    for (const chain of [chains.mateSplit, chains.deletion]) {
      expect(filterChainFeatures(chain, only)).toHaveLength(2)
    }
  })

  test('keeps everything when the category is absent', () => {
    expect(filterChainFeatures(all, filt())).toHaveLength(all.length)
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

  // A multimapper's secondary alignments come as a pair naming each other's
  // position. Each keys a chain of its own, so every one read as a read alone
  // and "Hide reads without a mate" hid secondary pairs with both mates shown.
  test('a secondary pair with both mates in the window has a mate', () => {
    const secondary = (id: string, start: number, nextPos: number) =>
      new SimpleFeature({
        uniqueId: id,
        refName: 'ctgA',
        start,
        end: start + 100,
        name: 'multi',
        flags: 0x1 | 0x100,
        next_pos: nextPos,
      })
    const features = [
      lone,
      secondary('multi-1', 1000, 1300),
      secondary('multi-2', 1300, 1000),
      secondary('multi-3', 5000, 9000),
    ]
    const kept = filterChainFeatures(features, filt({ singletons: 'exclude' }))
    expect(kept.map(f => f.id())).toEqual(['multi-1', 'multi-2'])
  })
})

// Every category is AND-ed.
test('filterChainFeatures ANDs the categories', () => {
  const [lone] = pair('loneDiscordant', 'F1F2', PAIRED | PROPER_PAIR)
  const features = [
    ...pair('plainProper', 'F1R2', PAIRED | PROPER_PAIR),
    ...pair('plainDiscordant', 'F1F2', PAIRED | PROPER_PAIR),
    lone!,
  ]
  // svSignal:only drops plainProper; singletons:exclude drops the lone read
  expect(
    names(
      filterChainFeatures(
        features,
        filt({ svSignal: 'only', singletons: 'exclude' }),
      ),
    ),
  ).toEqual(['plainDiscordant'])
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

describe('filterChainFeatures minMapq', () => {
  const read = (name: string, fields: Record<string, unknown>) =>
    new SimpleFeature({
      uniqueId: name,
      refName: 'ctgA',
      start: 0,
      end: 100,
      name,
      ...fields,
    })

  test('keeps a read at or over the minimum, record by record', () => {
    const features = [
      read('high', { score: 60 }),
      read('edge', { score: 20 }),
      read('low', { score: 3 }),
      read('zero', { score: 0 }),
    ]
    expect(names(filterChainFeatures(features, filt({ minMapq: 20 })))).toEqual(
      ['edge', 'high'],
    )
    expect(names(filterChainFeatures(features, filt()))).toHaveLength(4)
  })

  // BAM leaves `score` unset for MAPQ 255, which `getMappingQuality` reads as
  // unavailable; a synteny block spells it `mappingQual`, with no adapter
  // filter of its own, so this is where its threshold applies.
  test('an unavailable mapping quality fails any minimum, and a synteny block is read by mappingQual', () => {
    const features = [
      read('unavailable', {}),
      read('block', { mappingQual: 40 }),
      read('weakBlock', { mappingQual: 5 }),
    ]
    expect(names(filterChainFeatures(features, filt({ minMapq: 1 })))).toEqual([
      'block',
      'weakBlock',
    ])
    expect(names(filterChainFeatures(features, filt({ minMapq: 10 })))).toEqual(
      ['block'],
    )
  })
})
